import { watch } from "node:fs"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { commitGitChanges, fetchGit, pullGit, pushGit, readGitDiff, readGitState, restoreGitFiles, stageGitFiles, unstageGitFiles, type GitDiff, type GitFile, type GitFailure } from "./status"
import { createGitTree } from "./tree"

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
      setSelected((index) => Math.max(0, Math.min(index, createGitTree(next.files, expanded()).length - 1)))
    } finally {
      refreshing = false
      if (queued) { queued = false; void refresh() }
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
    setCommitFocused(false)
    setSelected(Math.max(0, Math.min(index, tree().length - 1)))
  }

  const tree = createMemo(() => createGitTree(state().files, expanded()))

  function toggleSelectedFolder() {
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

  function collapseAllFolders() { setExpanded(new Set<string>()) }

  function selectedFile() { return tree()[selected()]?.file }

  function selectedFiles() {
    const item = tree()[selected()]
    if (!item) return []
    if (item.file) return [item.file]
    const [area, ...parts] = item.path.split("/")
    const prefix = parts.join("/")
    return state().files.filter((file) => file.area === area && (!prefix || file.path === prefix || file.path.startsWith(`${prefix}/`)))
  }

  async function openSelected(): Promise<GitDiff | undefined> {
    const file = tree()[selected()]?.file
    if (!file) return
    try {
      return await readGitDiff(props.root, file)
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudieron mostrar los cambios.")
    }
  }

  async function fetch() {
    if (props.fetchOnRefresh === false) return refresh()
    await props.runActivity("Actualizando referencias remotas y cambios de Git...", () => fetchAndRefreshGit(props.root, readState, props.setStatus, (root) => fetchGit(root, reportGitFailure)))
  }

  async function stageSelected() {
    const files = selectedFiles().filter((file) => file.area === "changes")
    const staged = await stageGitFiles(props.root, files, reportGitFailure)
    if (staged) await refresh()
    return staged
  }

  async function unstageSelected() {
    const files = selectedFiles().filter((file) => file.area === "staged")
    const unstaged = await unstageGitFiles(props.root, files, reportGitFailure)
    if (unstaged) await refresh()
    return unstaged
  }

  async function restore(files: GitFile[]) {
    const restorable = files.filter((file) => file.area === "changes" && file.status !== "untracked")
    const restored = await restoreGitFiles(props.root, restorable, reportGitFailure)
    if (restored) await refresh()
    return restored
  }

  async function commit() {
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
    const pulled = await pullGit(props.root, reportGitFailure)
    if (pulled) await refresh()
    return pulled
  }

  async function push() {
    const pushed = await pushGit(props.root, reportGitFailure)
    if (pushed) await refresh()
    return pushed
  }

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
      controller.abort()
      if (timer) clearTimeout(timer)
      watcher?.close()
    })
  })

  return { state, tree, selected, commitMessage, setCommitMessage, commitFocused, setCommitFocused, refresh, fetch, moveSelection, select, toggleSelectedFolder, collapseAllFolders, selectedFile, selectedFiles, stageSelected, unstageSelected, restore, commit, pull, push, openSelected }
}
