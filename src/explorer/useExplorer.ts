import { createMemo, createSignal, onMount, type Accessor } from "solid-js"
import { dirname, join, relative, sep } from "node:path"
import { createTree, descendantDirectories, type TreeItem } from "./tree"
import type { MassiveFile } from "../search/project-search"
import { t } from "../localization"

type Props = {
  root: string
  setStatus: (status: string) => void
  openFile: (path: string) => Promise<unknown>
  massiveFiles: Accessor<MassiveFile[]>
  reportError?: (failure: { source: string; operation: string; summary: string; details: string }) => void
}

export function useExplorer(props: Props) {
  const [tree, setTree] = createSignal<TreeItem[]>([])
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set([props.root]))
  const [selected, setSelected] = createSignal(0)
  const [showMassiveFiles, setShowMassiveFiles] = createSignal(false)
  const visibleItems = createMemo<TreeItem[]>(() => showMassiveFiles()
    ? props.massiveFiles().map((file) => ({ path: file.path, name: file.path.slice(props.root.length + 1), depth: 0, directory: false, ignored: false }))
    : tree())
  const selectedItem = () => visibleItems()[selected()]

  const newFileDirectory = () => {
    const item = selectedItem()
    if (!item) return props.root
    return item.directory ? item.path : dirname(item.path)
  }

  async function refreshTree() {
    try {
      const nextTree = await createTree(props.root, expanded())
      setTree(nextTree)
      setSelected((current) => Math.min(current, Math.max(0, (showMassiveFiles() ? props.massiveFiles() : nextTree).length - 1)))
    } catch (error) {
      const summary = error instanceof Error ? error.message : t("explorer.readFailed")
      props.setStatus(summary)
      props.reportError?.({ source: t("log.explorer"), operation: t("log.readFolder"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
      return false
    }
    return true
  }

  async function refreshExplorer() {
    if (await refreshTree()) props.setStatus(t("explorer.refreshed"))
  }

  async function renameItem(path: string, nextPath: string, directory: boolean) {
    if (directory) {
      const nextExpanded = new Set<string>()
      for (const expandedPath of expanded()) {
        const fromRenamed = relative(path, expandedPath)
        nextExpanded.add(fromRenamed === "" || fromRenamed !== ".." && !fromRenamed.startsWith(`..${sep}`) ? join(nextPath, fromRenamed) : expandedPath)
      }
      setExpanded(nextExpanded)
    }
    if (await refreshTree()) {
      const nextIndex = tree().findIndex((item) => item.path === nextPath)
      if (nextIndex >= 0) setSelected(nextIndex)
    }
  }

  async function collapseAllFolders() {
    setExpanded(new Set<string>())
    setSelected(0)
    await refreshTree()
    props.setStatus(t("explorer.collapsedAll"))
  }

  async function collapseSelectedFolder() {
    const item = selectedItem()
    if (!item?.directory) {
      props.setStatus(t("explorer.selectFolder"))
      return
    }
    const next = new Set(expanded())
    if (next.has(item.path)) {
      for (const expandedPath of next) {
        const fromSelected = relative(item.path, expandedPath)
        if (fromSelected === "" || !fromSelected.startsWith("..")) next.delete(expandedPath)
      }
      setExpanded(next)
      await refreshTree()
      props.setStatus(t("explorer.collapsed", { name: item.name }))
      return
    }
    for (const path of await descendantDirectories(item.path)) next.add(path)
    setExpanded(next)
    await refreshTree()
    props.setStatus(t("explorer.expanded", { name: item.name }))
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
    const item = visibleItems()[index]
    if (!item) return
    setSelected(index)
    await activateItem(item)
  }

  function moveSelection(direction: number) {
    setSelected((value) => Math.max(0, Math.min(value + direction, visibleItems().length - 1)))
  }

  function showMassiveFilesView() {
    setShowMassiveFiles(true)
    setSelected(0)
  }

  function showTreeView() {
    setShowMassiveFiles(false)
    setSelected(0)
  }

  onMount(() => void refreshTree())

  return { tree: visibleItems, selected, setSelected, selectedItem, newFileDirectory, refreshTree, refreshExplorer, renameItem, collapseAllFolders, collapseSelectedFolder, activateItem, activateAt, moveSelection, showMassiveFiles, showMassiveFilesView, showTreeView }
}
