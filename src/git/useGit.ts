import { watch } from "node:fs"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { commitGitChanges, fetchGit, pullGit, pushGit, readGitDiff, readGitState, restoreGitFiles, stageGitFiles, unstageGitFiles, type GitDiff, type GitFile, type GitFailure } from "./status"
import { createGitTree, type GitTreeItem } from "./tree"
import { readGitBranches, readGitCommitFiles, readGitHistoricalDiff, readGitHistory } from "./history"

export type GitMode = "local" | "history" | "branches" | "files"
type HistoryView = { mode: GitMode; title: string; rows: GitTreeItem[]; revision?: string; ref?: string }

type Props = {
  root: string
  setStatus: (message: string) => void
  runActivity: <T>(message: string, operation: () => Promise<T>) => Promise<T>
  autoRefresh?: boolean
  fetchOnRefresh?: boolean
  reportFailure?: (failure: { source: string; operation: string; summary: string; details: string }) => void
}

export async function fetchAndRefreshGit(
  root: string,
  refresh: () => Promise<void>,
  setStatus: (message: string) => void,
  fetchRemote: (root: string) => Promise<boolean> = fetchGit,
) {
  setStatus("Actualizando referencias remotas y cambios de Git...")
  const fetched = await fetchRemote(root)
  await refresh()
  setStatus(fetched
    ? "Referencias remotas y cambios de Git actualizados."
    : "Cambios de Git actualizados; no se pudieron actualizar las referencias remotas.")
}

export function useGit(props: Props) {
  const [state, setState] = createSignal({ available: false, branch: "", remoteStatus: "", files: [] as GitFile[], message: "Comprobando Git..." })
  const [selected, setSelected] = createSignal(0)
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = createSignal("")
  const [commitFocused, setCommitFocused] = createSignal(false)
  const [view, setView] = createSignal<HistoryView>({ mode: "local", title: "", rows: [] })
  const mode = () => view().mode
  const historyTitle = () => view().title
  const [loading, setLoading] = createSignal(false)
  const backStack: Array<{ view: HistoryView; selected: number; focused: boolean; path?: string }> = []
  let navigation = 0
  let historyController = new AbortController()
  let initializedExpansion = false
  let refreshing = false
  let queued = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  function reportGitFailure(failure: GitFailure) {
    props.reportFailure?.({ source: "Git", operation: failure.operation, summary: `${failure.operation} falló${failure.exitCode === undefined ? "" : ` (código ${failure.exitCode})`}.`, details: [failure.stderr, failure.stdout].filter(Boolean).join("\n") || "Git no devolvió detalles." })
  }

  async function readState() {
    if (refreshing) { queued = true; return }
    refreshing = true
    try {
      const next = await readGitState(props.root, controller.signal)
      if (controller.signal.aborted) return
      setState(next)
      if (!initializedExpansion) {
        initializedExpansion = true
        setExpanded(() => {
          const nextExpanded = new Set<string>()
          for (const file of next.files) {
            nextExpanded.add(file.area)
            const parts = file.path.replace(/\\/g, "/").split("/")
            for (let index = 1; index < parts.length; index += 1) nextExpanded.add(`${file.area}/${parts.slice(0, index).join("/")}`)
          }
          return nextExpanded
        })
      }
      if (mode() === "local") setSelected((index) => Math.max(0, Math.min(index, createGitTree(next.files, expanded()).length - 1)))
    } finally {
      refreshing = false
      if (queued && !controller.signal.aborted) { queued = false; void refresh() }
    }
  }

  async function refresh() {
    await readState()
  }

  function scheduleRefresh(_event: string, fileName: string | Buffer | null) {
    if (fileName?.toString().replace(/\\/g, "/").startsWith(".git/")) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void refresh(), 400)
  }

  function moveSelection(direction: number) {
    if (loading()) return
    if (mode() !== "local") {
      setSelected((index) => Math.max(0, Math.min(index + direction, tree().length - 1)))
      if (tree()[selected()]?.loadMore) void loadMore()
      return
    }
    if (commitFocused()) {
      if (direction < 0) setCommitFocused(false)
      return
    }
    if (direction > 0 && selected() >= tree().length - 1) {
      setCommitFocused(true)
      return
    }
    setSelected((index) => Math.max(0, Math.min(index + direction, tree().length - 1)))
  }

  function select(index: number) {
    if (loading()) return
    setCommitFocused(false)
    setSelected(Math.max(0, Math.min(index, tree().length - 1)))
  }

  const tree = createMemo(() => mode() === "local" ? createGitTree(state().files, expanded()) : view().rows)

  function cancelNavigation() {
    navigation += 1
    historyController.abort()
    historyController = new AbortController()
    setLoading(false)
    return navigation
  }

  function enter(next: HistoryView, topLevel = false) {
    cancelNavigation()
    if (topLevel && mode() !== "local") {
      const local = backStack[0]
      backStack.splice(1)
      if (!local) backStack.length = 0
    } else backStack.push({ view: view(), selected: selected(), focused: commitFocused(), path: tree()[selected()]?.path })
    setCommitFocused(false)
    setSelected(0)
    setView(next)
  }

  async function load(operation: (signal: AbortSignal) => Promise<HistoryView>) {
    const token = navigation
    const signal = historyController.signal
    setLoading(true)
    try {
      const next = await operation(signal)
      if (token === navigation && !signal.aborted) setView(next)
    } catch (error) {
      if (token === navigation && !signal.aborted) props.setStatus(error instanceof Error ? error.message : "No se pudo leer el historial.")
    } finally {
      if (token === navigation) setLoading(false)
    }
  }

  async function showHistory(ref = "HEAD", title = `Historial: ${ref === "HEAD" ? state().branch || "HEAD" : ref.replace(/^refs\/(heads|remotes)\//, "")}`) {
    enter({ mode: "history", title, rows: [], ref }, true)
    await loadHistory(ref)
  }

  async function loadHistory(ref: string) {
    const current = view()
    const existing = current.rows.filter((row) => !row.loadMore)
    await load(async (signal) => {
      const page = await readGitHistory(props.root, ref, existing.length, undefined, signal)
      const rows: GitTreeItem[] = [...existing, ...page.commits.map((commit) => ({ path: commit.revision, name: `${commit.revision.slice(0, 8)} ${commit.subject} (${commit.author}, ${commit.date.slice(0, 10)})`, depth: 0, directory: false, expanded: false, commit }))]
      if (page.hasMore) rows.push({ path: "history:more", name: "Cargar mas commits...", depth: 0, directory: false, expanded: false, loadMore: true })
      return { ...current, rows, revision: page.revision }
    })
  }

  async function loadMore() {
    if (loading() || mode() !== "history" || !view().rows.at(-1)?.loadMore || !view().revision) return
    await loadHistory(view().revision!)
  }

  async function showBranches() {
    enter({ mode: "branches", title: "Ramas locales y remotas", rows: [] }, true)
    await loadBranches()
  }

  async function loadBranches() {
    await load(async (signal) => ({ mode: "branches", title: "Ramas locales y remotas", rows: (await readGitBranches(props.root, signal)).map((branch) => ({ path: branch.ref, name: `${branch.current ? "* " : "  "}${branch.name}${branch.remote ? " [remota]" : " [local]"}`, depth: 0, directory: false, expanded: false, branch })) }))
  }

  function goBack(): boolean {
    if (mode() === "local") return false
    cancelNavigation()
    const previous = backStack.pop()
    setView(previous?.view ?? { mode: "local", title: "", rows: [] })
    const restoredIndex = previous?.path ? tree().findIndex((row) => row.path === previous.path) : -1
    setSelected(Math.max(0, Math.min(restoredIndex >= 0 ? restoredIndex : previous?.selected ?? 0, tree().length - 1)))
    setCommitFocused(mode() === "local" && (previous?.focused ?? false))
    return true
  }

  function toggleSelectedFolder() {
    if (mode() !== "local") return false
    const item = tree()[selected()]
    if (!item?.directory) return false
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      return next
    })
    return true
  }

  function collapseAllFolders() { if (mode() === "local") setExpanded(new Set<string>()) }

  function selectedFile() { return mode() === "local" ? tree()[selected()]?.file : undefined }

  function selectedFiles() {
    if (mode() !== "local") return []
    const item = tree()[selected()]
    if (!item) return []
    if (item.file) return [item.file]
    const [area, ...parts] = item.path.split("/")
    const prefix = parts.join("/")
    return state().files.filter((file) => file.area === area && (!prefix || file.path === prefix || file.path.startsWith(`${prefix}/`)))
  }

  async function openSelected(): Promise<GitDiff | undefined> {
    if (mode() !== "local") {
      if (loading()) return
      const item = tree()[selected()]
      if (!item) return
      if (item.loadMore) { await loadMore(); return }
      if (item.branch) {
        enter({ mode: "history", title: `Historial: ${item.branch.name}`, rows: [], ref: item.branch.ref })
        await loadHistory(item.branch.ref)
        return
      }
      if (item.commit) {
        const revision = item.commit.revision
        enter({ mode: "files", title: `${revision.slice(0, 8)} ${item.commit.subject}`, rows: [], revision })
        const current = view()
        await load(async (signal) => ({ ...current, rows: (await readGitCommitFiles(props.root, revision, signal)).map((file, index) => ({ path: file.path, name: file.path, depth: 0, directory: false, expanded: false, file, fileNumber: index + 1 })) }))
        return
      }
      if (!item.file || !view().revision) return
      const token = cancelNavigation()
      const signal = historyController.signal
      setLoading(true)
      try {
        const diff = await readGitHistoricalDiff(props.root, view().revision!, item.file, signal)
        if (token !== navigation || signal.aborted) return
        return diff
      } catch (error) {
        if (token === navigation && !signal.aborted) props.setStatus(error instanceof Error ? error.message : "No se pudo leer el diff historico.")
      } finally {
        if (token === navigation) setLoading(false)
      }
      return
    }
    const file = tree()[selected()]?.file
    if (!file) return
    const token = navigation
    try {
      const diff = await readGitDiff(props.root, file)
      if (token === navigation && !controller.signal.aborted) return diff
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudieron mostrar los cambios.")
    }
  }

  async function fetch() {
    const token = navigation
    async function refreshVisible() {
      await readState()
      if (token !== navigation || controller.signal.aborted) return
      const current = view()
      if (current.mode !== "branches" && current.mode !== "history") return
      cancelNavigation()
      setSelected(0)
      setView({ ...current, rows: [], revision: undefined })
      if (current.mode === "branches") await loadBranches()
      else await loadHistory(current.ref ?? "HEAD")
    }
    if (props.fetchOnRefresh === false) return refreshVisible()
    await props.runActivity("Actualizando referencias remotas y cambios de Git...", () => fetchAndRefreshGit(props.root, refreshVisible, props.setStatus, (root) => fetchGit(root, reportGitFailure)))
  }

  async function stageSelected() {
    if (mode() !== "local") return false
    const files = selectedFiles().filter((file) => file.area === "changes")
    const staged = await stageGitFiles(props.root, files, reportGitFailure)
    if (staged) await refresh()
    return staged
  }

  async function unstageSelected() {
    if (mode() !== "local") return false
    const files = selectedFiles().filter((file) => file.area === "staged")
    const unstaged = await unstageGitFiles(props.root, files, reportGitFailure)
    if (unstaged) await refresh()
    return unstaged
  }

  async function restore(files: GitFile[]) {
    if (mode() !== "local") return false
    const restorable = files.filter((file) => file.area === "changes" && file.status !== "untracked")
    const restored = await restoreGitFiles(props.root, restorable, reportGitFailure)
    if (restored) await refresh()
    return restored
  }

  async function commit() {
    if (mode() !== "local") return false
    const message = commitMessage().trim()
    if (!message || !state().files.some((file) => file.area === "staged")) return false
    const committed = await commitGitChanges(props.root, message, reportGitFailure)
    if (committed) {
      setCommitMessage("")
      await refresh()
    }
    return committed
  }

  async function pull() {
    if (mode() !== "local") return false
    const pulled = await pullGit(props.root, reportGitFailure)
    if (pulled) await refresh()
    return pulled
  }

  async function push() {
    if (mode() !== "local") return false
    const pushed = await pushGit(props.root, reportGitFailure)
    if (pushed) await refresh()
    return pushed
  }

  onCleanup(() => {
    controller.abort()
    cancelNavigation()
    if (timer) clearTimeout(timer)
  })

  onMount(() => {
    let disposed = false
    let watcher: ReturnType<typeof watch> | undefined
    void refresh().then(() => {
      if (disposed || !state().available) return
      if (props.autoRefresh === false) return
      watcher = watch(props.root, { recursive: true }, scheduleRefresh)
      watcher.on("error", () => undefined)
    })
    onCleanup(() => {
      disposed = true
      watcher?.close()
    })
  })

  return { state, tree, selected, commitMessage, setCommitMessage, commitFocused, setCommitFocused, refresh, fetch, moveSelection, select, toggleSelectedFolder, collapseAllFolders, selectedFile, selectedFiles, stageSelected, unstageSelected, restore, commit, pull, push, openSelected, mode, historyTitle, loading, showHistory, showBranches, goBack, loadMore }
}
