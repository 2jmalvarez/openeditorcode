import { createSignal, onMount } from "solid-js"
import { dirname, relative } from "node:path"
import { createTree, type TreeItem } from "./tree"

type Props = {
  root: string
  setStatus: (status: string) => void
  openFile: (path: string) => Promise<void>
}

export function useExplorer(props: Props) {
  const [tree, setTree] = createSignal<TreeItem[]>([])
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set([props.root]))
  const [selected, setSelected] = createSignal(0)
  const selectedItem = () => tree()[selected()]

  const newFileDirectory = () => {
    const item = selectedItem()
    if (!item) return props.root
    return item.directory ? item.path : dirname(item.path)
  }

  async function refreshTree() {
    try {
      const nextTree = await createTree(props.root, expanded())
      setTree(nextTree)
      setSelected((current) => Math.min(current, Math.max(0, nextTree.length - 1)))
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo leer la carpeta.")
    }
  }

  async function refreshExplorer() {
    await refreshTree()
    props.setStatus("Explorador actualizado.")
  }

  async function collapseAllFolders() {
    setExpanded(new Set<string>())
    setSelected(0)
    await refreshTree()
    props.setStatus("Todas las carpetas fueron contraídas.")
  }

  async function collapseSelectedFolder() {
    const item = selectedItem()
    if (!item?.directory) {
      props.setStatus("Selecciona una carpeta para contraerla.")
      return
    }
    if (!expanded().has(item.path)) {
      props.setStatus("La carpeta seleccionada ya está contraída.")
      return
    }
    const next = new Set(expanded())
    for (const expandedPath of next) {
      const fromSelected = relative(item.path, expandedPath)
      if (fromSelected === "" || !fromSelected.startsWith("..")) next.delete(expandedPath)
    }
    setExpanded(next)
    await refreshTree()
    props.setStatus(`Carpeta contraída: ${item.name}`)
  }

  async function activateItem(item = selectedItem()) {
    if (!item) return
    if (item.directory) {
      const next = new Set(expanded())
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      setExpanded(next)
      await refreshTree()
      return
    }
    await props.openFile(item.path)
  }

  async function activateAt(index: number) {
    const item = tree()[index]
    if (!item) return
    setSelected(index)
    await activateItem(item)
  }

  function moveSelection(direction: number) {
    setSelected((value) => Math.max(0, Math.min(value + direction, tree().length - 1)))
  }

  async function removeSelected(remove: (path: string) => Promise<void>) {
    const item = selectedItem()
    if (!item) return
    await remove(item.path)
    await refreshTree()
  }

  onMount(() => void refreshTree())

  return { tree, selected, setSelected, selectedItem, newFileDirectory, refreshTree, refreshExplorer, collapseAllFolders, collapseSelectedFolder, activateItem, activateAt, moveSelection, removeSelected }
}
