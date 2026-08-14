import { watch } from "node:fs"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { fetchGit, readGitDiff, readGitState, restoreGitFile, stageGitFile, unstageGitFile, type GitDiff, type GitFile } from "./status"
import { createGitTree } from "./tree"

type Props = {
  root: string
  setStatus: (message: string) => void
  runActivity: <T>(message: string, operation: () => Promise<T>) => Promise<T>
  autoRefresh?: boolean
  fetchOnRefresh?: boolean
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
  let refreshing = false
  let queued = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  async function readState() {
    if (refreshing) { queued = true; return }
    refreshing = true
    try {
      const next = await readGitState(props.root, controller.signal)
      setState(next)
      setExpanded((current) => {
        const nextExpanded = new Set(current)
        for (const file of next.files) {
          nextExpanded.add(file.area)
          const parts = file.path.replace(/\\/g, "/").split("/")
          for (let index = 1; index < parts.length; index += 1) nextExpanded.add(`${file.area}/${parts.slice(0, index).join("/")}`)
        }
        return nextExpanded
      })
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
    setSelected((index) => Math.max(0, Math.min(index + direction, tree().length - 1)))
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
    await props.runActivity("Actualizando referencias remotas y cambios de Git...", () => fetchAndRefreshGit(props.root, readState, props.setStatus))
  }

  async function stageSelected() {
    const file = selectedFile()
    if (!file || file.area !== "changes") return false
    const staged = await stageGitFile(props.root, file)
    if (staged) await refresh()
    return staged
  }

  async function unstageSelected() {
    const file = selectedFile()
    if (!file || file.area !== "staged") return false
    const unstaged = await unstageGitFile(props.root, file)
    if (unstaged) await refresh()
    return unstaged
  }

  async function restoreSelected() {
    const file = selectedFile()
    if (!file || file.area !== "changes" || file.status === "untracked") return false
    const restored = await restoreGitFile(props.root, file)
    if (restored) await refresh()
    return restored
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

  return { state, tree, selected, refresh, fetch, moveSelection, toggleSelectedFolder, collapseAllFolders, selectedFile, stageSelected, unstageSelected, restoreSelected, openSelected }
}
