import { watch } from "node:fs"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { commitGitChanges, fetchGit, pullGit, pushGit, readGitDiff, readGitState, restoreGitFiles, stageGitFiles, unstageGitFiles, type GitDiff, type GitFile, type GitFailure, type GitState } from "./status"
import { createGitTree, type GitTreeItem } from "./tree"
import { readGitBranches, readGitCommitFiles, readGitHistoricalDiff, readGitHistory } from "./history"
import { discoverGitRepositories, type GitRepository } from "./repositories"
import { t } from "../localization"

export type GitMode = "repositories" | "local" | "history" | "branches" | "files"
type HistoryView = { mode: GitMode; title: string; rows: GitTreeItem[]; revision?: string; ref?: string }
type Props = { root: string; setStatus: (message: string) => void; runActivity: <T>(message: string, operation: () => Promise<T>) => Promise<T>; autoRefresh?: boolean; fetchOnRefresh?: boolean; reportFailure?: (failure: { source: string; operation: string; summary: string; details: string }) => void }

export async function fetchAndRefreshGit(root: string, refresh: () => Promise<void>, setStatus: (message: string) => void, fetchRemote: (root: string) => Promise<boolean> = fetchGit) {
  setStatus(t("git.refreshActivity"))
  const fetched = await fetchRemote(root)
  await refresh()
  setStatus(t(fetched ? "git.refreshed" : "git.partialRefresh"))
}

export function useGit(props: Props) {
  const initialState = (): GitState => ({ available: false, branch: "", remoteStatus: "", files: [], message: t("git.checking") })
  const [state, setState] = createSignal<GitState>(initialState())
  const [repositories, setRepositories] = createSignal<GitRepository[]>([])
  const [repository, setRepository] = createSignal<GitRepository>()
  const [selected, setSelected] = createSignal(0)
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = createSignal("")
  const [commitFocused, setCommitFocused] = createSignal(false)
  const [view, setView] = createSignal<HistoryView>({ mode: "local", title: "", rows: [] })
  const mode = () => view().mode
  const historyTitle = () => mode() === "repositories" ? t("git.repositories") : mode() === "branches" ? t("git.branches") : mode() === "history" ? t("git.history", { ref: view().ref === "HEAD" ? state().branch || "HEAD" : view().ref?.replace(/^refs\/(heads|remotes)\//, "") }) : view().title
  const [loading, setLoading] = createSignal(false)
  const [showCommitHashes, setShowCommitHashes] = createSignal(true)
  const [showCommitDates, setShowCommitDates] = createSignal(true)
  const backStack: Array<{ view: HistoryView; selected: number; focused: boolean; path?: string }> = []
  let navigation = 0
  let historyController = new AbortController()
  let refreshing = false
  let queued = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  function reportGitFailure(failure: GitFailure) { props.reportFailure?.({ source: "Git", operation: failure.operation, summary: t("git.failure", { operation: failure.operation, code: failure.exitCode === undefined ? "" : t("git.exitCode", { code: failure.exitCode }) }), details: [failure.stderr, failure.stdout].filter(Boolean).join("\n") || t("git.noDetails") }) }
  async function ensureRepository() {
    if (repository()) return repository()!
    // Hooks used outside a mounted renderer still support the traditional single-repository API.
    if (!repositories().length) {
      const provisional = { id: ".", root: props.root, workspacePath: "", name: props.root }
      setRepository(provisional)
      return provisional
    }
    const found = await discoverGitRepositories(props.root)
    setRepositories(found)
    if (found.length === 1) { setRepository(found[0]); return found[0] }
    return undefined
  }
  function provisionalRepository() {
    if (repository() || repositories().length) return repository()
    const provisional = { id: ".", root: props.root, workspacePath: "", name: props.root }
    setRepository(provisional)
    return provisional
  }
  function repositoryRows(): GitTreeItem[] { return repositories().map((item) => ({ path: `repository:${item.id}`, name: item.name, depth: 0, directory: false, expanded: false, repository: item })) }
  const tree = createMemo(() => mode() === "repositories" ? repositoryRows() : mode() === "local" ? createGitTree(state().files, expanded()) : view().rows)

  async function readState() {
    if (refreshing) { queued = true; return }
    refreshing = true
    try {
      const found = await discoverGitRepositories(props.root)
      if (controller.signal.aborted) return
      setRepositories(found)
      const current = repository()
      const nextRepository = current && found.find((item) => item.id === current.id)
      if (nextRepository) setRepository(nextRepository)
      else if (found.length === 1) { setRepository(found[0]); if (mode() === "repositories") setView({ mode: "local", title: "", rows: [] }) }
      else if (!found.length || !current) { setRepository(undefined); setState({ ...initialState(), message: t("git.notRepository") }); setView({ mode: found.length ? "repositories" : "local", title: "", rows: [] }); setSelected(0); return }
      const active = repository()
      if (!active) return
      const next = await readGitState(active.root, active.workspacePath, controller.signal)
      if (controller.signal.aborted) return
      setState(next)
      if (!expanded().size) {
        const nextExpanded = new Set<string>()
        for (const file of next.files) {
          nextExpanded.add(file.area)
          const parts = file.path.split("/")
          for (let index = 1; index < parts.length; index += 1) nextExpanded.add(`${file.area}/${parts.slice(0, index).join("/")}`)
        }
        setExpanded(nextExpanded)
      }
      if (mode() === "local") setSelected((index) => Math.max(0, Math.min(index, createGitTree(next.files, expanded()).length - 1)))
    } finally {
      refreshing = false
      if (queued && !controller.signal.aborted) { queued = false; void refresh() }
    }
  }
  async function refresh() { await readState() }
  function scheduleRefresh(_event: string, fileName: string | Buffer | null) {
    if (fileName?.toString().replace(/\\/g, "/").split("/").includes(".git")) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void refresh(), 400)
  }
  function moveSelection(direction: number) {
    if (loading()) return
    if (mode() === "local" && commitFocused()) { if (direction < 0) setCommitFocused(false); return }
    if (mode() === "local" && direction > 0 && selected() >= tree().length - 1) { setCommitFocused(true); return }
    setSelected((index) => Math.max(0, Math.min(index + direction, tree().length - 1)))
    if (mode() === "history" && tree()[selected()]?.loadMore) void loadMore()
  }
  function select(index: number) { if (!loading()) { setCommitFocused(false); setSelected(Math.max(0, Math.min(index, tree().length - 1))) } }
  function cancelNavigation() { navigation += 1; historyController.abort(); historyController = new AbortController(); setLoading(false); return navigation }
  function enter(next: HistoryView, topLevel = false) { cancelNavigation(); if (topLevel && mode() !== "local") { const local = backStack[0]; backStack.splice(1); if (!local) backStack.length = 0 } else backStack.push({ view: view(), selected: selected(), focused: commitFocused(), path: tree()[selected()]?.path }); setCommitFocused(false); setSelected(0); setView(next) }
  async function load(operation: (signal: AbortSignal) => Promise<HistoryView>) { const token = navigation; const signal = historyController.signal; setLoading(true); try { const next = await operation(signal); if (token === navigation && !signal.aborted) setView(next) } catch (error) { if (token === navigation && !signal.aborted) props.setStatus(error instanceof Error ? error.message : t("git.historyFailed")) } finally { if (token === navigation) setLoading(false) } }
  async function showHistory(ref = "HEAD", title = t("git.history", { ref: ref === "HEAD" ? state().branch || "HEAD" : ref.replace(/^refs\/(heads|remotes)\//, "") })) { if (!provisionalRepository() && !await ensureRepository()) return; enter({ mode: "history", title, rows: [], ref }, true); await loadHistory(ref) }
  async function loadHistory(ref: string) { const active = repository(); if (!active) return; const current = view(); const existing = current.rows.filter((row) => !row.loadMore); await load(async (signal) => { const page = await readGitHistory(active.root, ref, existing.length, undefined, signal); const rows = [...existing, ...page.commits.map((commit) => ({ path: commit.revision, name: `${commit.subject} (${commit.author})`, depth: 0, directory: false, expanded: false, commit }))]; if (page.hasMore) rows.push({ path: "history:more", name: t("git.loadMore"), depth: 0, directory: false, expanded: false, loadMore: true }); return { ...current, rows, revision: page.revision } }) }
  async function loadMore() { if (!loading() && mode() === "history" && view().rows.at(-1)?.loadMore && view().revision) await loadHistory(view().revision!) }
  async function showBranches() { if (!provisionalRepository() && !await ensureRepository()) return; enter({ mode: "branches", title: t("git.branches"), rows: [] }, true); const active = repository()!; await load(async (signal) => ({ mode: "branches", title: t("git.branches"), rows: (await readGitBranches(active.root, signal)).map((branch) => ({ path: branch.ref, name: `${branch.current ? "* " : "  "}${branch.name}${t(branch.remote ? "git.remoteBranch" : "git.localBranch")}`, depth: 0, directory: false, expanded: false, branch })) })) }
  function goBack(): boolean {
    if (mode() === "repositories") return false
    if (mode() === "local") { if (repositories().length < 2) return false; cancelNavigation(); setRepository(undefined); setState(initialState()); setView({ mode: "repositories", title: "", rows: [] }); setSelected(0); return true }
    cancelNavigation(); const previous = backStack.pop(); setView(previous?.view ?? { mode: "local", title: "", rows: [] }); const restored = previous?.path ? tree().findIndex((row) => row.path === previous.path) : -1; setSelected(Math.max(0, Math.min(restored >= 0 ? restored : previous?.selected ?? 0, tree().length - 1))); setCommitFocused(mode() === "local" && (previous?.focused ?? false)); return true
  }
  function toggleSelectedFolder() { if (mode() !== "local") return false; const item = tree()[selected()]; if (!item?.directory) return false; setExpanded((current) => { const next = new Set(current); next.has(item.path) ? next.delete(item.path) : next.add(item.path); return next }); return true }
  function collapseAllFolders() { if (mode() === "local") setExpanded(new Set<string>()) }
  function selectedFile() { return mode() === "local" ? tree()[selected()]?.file : undefined }
  function selectedFiles() { if (mode() !== "local") return []; const item = tree()[selected()]; if (!item) return []; if (item.file) return [item.file]; const [area, ...parts] = item.path.split("/"); const prefix = parts.join("/"); return state().files.filter((file) => file.area === area && (!prefix || file.path === prefix || file.path.startsWith(`${prefix}/`))) }
  async function openSelected(): Promise<GitDiff | undefined> {
    if (mode() === "repositories") { const next = tree()[selected()]?.repository; if (!next) return; cancelNavigation(); setRepository(next); setState(initialState()); setView({ mode: "local", title: "", rows: [] }); setSelected(0); await readState(); return }
    const active = repository(); if (!active) return
    if (mode() !== "local") { if (loading()) return; const item = tree()[selected()]; if (!item) return; if (item.loadMore) { await loadMore(); return } if (item.branch) { enter({ mode: "history", title: t("git.history", { ref: item.branch.name }), rows: [], ref: item.branch.ref }); await loadHistory(item.branch.ref); return } if (item.commit) { const revision = item.commit.revision; enter({ mode: "files", title: `${revision.slice(0, 8)} ${item.commit.subject}`, rows: [], revision }); const current = view(); await load(async (signal) => ({ ...current, rows: (await readGitCommitFiles(active.root, revision, active.workspacePath, signal)).map((file, index) => ({ path: file.path, name: file.path, depth: 0, directory: false, expanded: false, file, fileNumber: index + 1 })) })); return } if (!item.file || !view().revision) return; const token = cancelNavigation(); const signal = historyController.signal; setLoading(true); try { const diff = { ...await readGitHistoricalDiff(active.root, view().revision!, item.file, signal), repositoryId: active.id }; if (token === navigation && !signal.aborted) return diff } catch (error) { if (token === navigation && !signal.aborted) props.setStatus(error instanceof Error ? error.message : t("git.diffFailed")) } finally { if (token === navigation) setLoading(false) }; return }
    const file = tree()[selected()]?.file; if (!file) return; try { return { ...await readGitDiff(active.root, file), repositoryId: active.id } } catch (error) { props.setStatus(error instanceof Error ? error.message : t("git.changesFailed")) }
  }
  async function fetch() {
    const active = repository()
    if (!active) return refresh()
    const token = navigation
    const refreshVisible = async () => {
      await refresh()
      if (token !== navigation || controller.signal.aborted) return
      const current = view()
      if (current.mode !== "branches" && current.mode !== "history") return
      cancelNavigation()
      setSelected(0)
      setView({ ...current, rows: [], revision: undefined })
      if (current.mode === "branches") await load(async (signal) => ({ mode: "branches", title: t("git.branches"), rows: (await readGitBranches(active.root, signal)).map((branch) => ({ path: branch.ref, name: `${branch.current ? "* " : "  "}${branch.name}${t(branch.remote ? "git.remoteBranch" : "git.localBranch")}`, depth: 0, directory: false, expanded: false, branch })) }))
      else await loadHistory(current.ref ?? "HEAD")
    }
    if (props.fetchOnRefresh === false) return refreshVisible()
    await props.runActivity(t("git.refreshActivity"), () => fetchAndRefreshGit(active.root, refreshVisible, props.setStatus, (root) => fetchGit(root, reportGitFailure)))
  }
  async function stageSelected() { if (mode() !== "local") return false; const active = repository(); const files = selectedFiles().filter((file) => file.area === "changes"); const done = Boolean(active) && await stageGitFiles(active!.root, files, reportGitFailure); if (done) await refresh(); return done }
  async function unstageSelected() { if (mode() !== "local") return false; const active = repository(); const files = selectedFiles().filter((file) => file.area === "staged"); const done = Boolean(active) && await unstageGitFiles(active!.root, files, reportGitFailure); if (done) await refresh(); return done }
  async function restore(files: GitFile[]) { if (mode() !== "local") return false; const active = repository(); const done = Boolean(active) && await restoreGitFiles(active!.root, files.filter((file) => file.area === "changes" && file.status !== "untracked"), reportGitFailure); if (done) await refresh(); return done }
  async function commit() { const active = repository(); const message = commitMessage().trim(); const done = Boolean(active && message && state().files.some((file) => file.area === "staged")) && await commitGitChanges(active!.root, message, reportGitFailure); if (done) { setCommitMessage(""); await refresh() }; return done }
  async function pull() { const active = repository(); const done = Boolean(active) && await pullGit(active!.root, reportGitFailure); if (done) await refresh(); return done }
  async function push() { const active = repository(); const done = Boolean(active) && await pushGit(active!.root, reportGitFailure); if (done) await refresh(); return done }
  onCleanup(() => { controller.abort(); cancelNavigation(); if (timer) clearTimeout(timer) })
  onMount(() => { let watcher: ReturnType<typeof watch> | undefined; void refresh(); if (props.autoRefresh !== false) { watcher = watch(props.root, { recursive: true }, scheduleRefresh); watcher.on("error", () => undefined) }; onCleanup(() => watcher?.close()) })
  return { state, repositories, repository, tree, selected, commitMessage, setCommitMessage, commitFocused, setCommitFocused, refresh, fetch, moveSelection, select, toggleSelectedFolder, collapseAllFolders, selectedFile, selectedFiles, stageSelected, unstageSelected, restore, commit, pull, push, openSelected, mode, historyTitle, loading, showHistory, showBranches, goBack, loadMore, showCommitHashes, showCommitDates, toggleCommitHashes: () => setShowCommitHashes((value) => !value), toggleCommitDates: () => setShowCommitDates((value) => !value) }
}
