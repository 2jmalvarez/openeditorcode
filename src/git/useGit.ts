import { watch } from "node:fs"
import { createSignal, onCleanup, onMount } from "solid-js"
import { fetchGit, readGitDiff, readGitState, type GitDiff, type GitFile } from "./status"
import { createGitTree } from "./tree"

type Props = {
  root: string
  setStatus: (message: string) => void
}

export function useGit(props: Props) {
  const [state, setState] = createSignal({ available: false, branch: "", remoteStatus: "", files: [] as GitFile[], message: "Comprobando Git..." })
  const [selected, setSelected] = createSignal(0)
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set())
  let refreshing = false
  let queued = false
  let timer: ReturnType<typeof setTimeout> | undefined

  async function refresh() {
    if (refreshing) { queued = true; return }
    refreshing = true
    try {
      const next = await readGitState(props.root)
      setState(next)
      setExpanded((current) => {
        const nextExpanded = new Set(current)
        for (const file of next.files) {
          const parts = file.path.replace(/\\/g, "/").split("/")
          for (let index = 1; index < parts.length; index += 1) nextExpanded.add(parts.slice(0, index).join("/"))
        }
        return nextExpanded
      })
      setSelected((index) => Math.max(0, Math.min(index, createGitTree(next.files, expanded()).length - 1)))
    } finally {
      refreshing = false
      if (queued) { queued = false; void refresh() }
    }
  }

  function scheduleRefresh(_event: string, fileName: string | Buffer | null) {
    if (fileName?.toString().replace(/\\/g, "/").startsWith(".git/")) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void refresh(), 400)
  }

  function moveSelection(direction: number) {
    setSelected((index) => Math.max(0, Math.min(index + direction, tree().length - 1)))
  }

  const tree = () => createGitTree(state().files, expanded())

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
    props.setStatus("Actualizando referencias remotas de Git...")
    if (await fetchGit(props.root)) {
      await refresh()
      props.setStatus("Referencias remotas de Git actualizadas.")
    } else {
      props.setStatus("No se pudieron actualizar las referencias remotas de Git.")
    }
  }

  onMount(() => {
    let disposed = false
    let watcher: ReturnType<typeof watch> | undefined
    void refresh().then(() => {
      if (disposed || !state().available) return
      watcher = watch(props.root, { recursive: true }, scheduleRefresh)
      watcher.on("error", () => undefined)
      void fetch()
    })
    onCleanup(() => {
      disposed = true
      if (timer) clearTimeout(timer)
      watcher?.close()
    })
  })

  return { state, tree, selected, refresh, fetch, moveSelection, toggleSelectedFolder, collapseAllFolders, openSelected }
}
