import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { basename, dirname } from "node:path"
import { type Command } from "../dialogs/Overlays"
import { useOverlays } from "../dialogs/useOverlays"
import { useDocuments } from "../documents/useDocuments"
import { useEditor } from "../editor/useEditor"
import { useExplorer } from "../explorer/useExplorer"
import { displayPath } from "../explorer/tree"
import { removeProjectEntry } from "../documents/files"
import { useSearch } from "../search/useSearch"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"
import type { FocusTarget } from "./types"

export function useWorkbench(root: string) {
  const renderer = useRenderer()
  const [active, setActive] = createSignal<FocusTarget>("explorer")
  const [explorerVisible, setExplorerVisible] = createSignal(true)
  const [status, setStatus] = createSignal("Explorador listo")
  let explorerScroll: ScrollBoxRenderable | undefined
  const overlays = useOverlays()
  const editor = useEditor({ active, overlay: overlays.overlay, filePath: () => documents.filePath(), setStatus })
  const documents = useDocuments({
    root,
    getText: editor.currentText,
    setText: editor.setText,
    clearEditor: editor.clear,
    focusEditor: () => setActive("editor"),
    focusExplorer: () => { setExplorerVisible(true); setActive("explorer") },
    setStatus,
  })
  const explorer = useExplorer({ root, setStatus, openFile: documents.openFile })
  const search = useSearch({ root, setStatus })

  function openOverlay(kind: "command-palette" | "project-search" | "new-file") {
    overlays.open(kind)
    search.reset()
  }

  function requestClose() {
    if (!documents.filePath()) return
    if (documents.dirty()) {
      overlays.requestConfirm("close")
      setStatus("Hay cambios sin guardar.")
      return
    }
    documents.closeFile()
  }

  function quit() {
    if (documents.dirty()) {
      overlays.requestConfirm("quit")
      setStatus("Hay cambios sin guardar.")
      return
    }
    renderer.destroy()
  }

  async function acceptConfirm() {
    const choice = overlays.confirmChoice()
    const action = overlays.pendingAction()
    if (choice < 2 && !(await documents.save())) return
    overlays.close()
    if (choice === 0) return
    if (choice === 2) setStatus("Cambios descartados.")
    if (action === "close") documents.closeFile()
    if (action === "quit") renderer.destroy()
  }

  async function createNewFile() {
    if (await documents.createFile(explorer.newFileDirectory(), overlays.newFileName().trim(), explorer.refreshTree)) overlays.close()
  }

  async function acceptDeletion() {
    const item = overlays.pendingDeletion()
    if (!item) return overlays.close()
    try {
      await explorer.removeSelected((path) => removeProjectEntry(root, path))
      overlays.close()
      setStatus(`${item.directory ? "Carpeta" : "Archivo"} eliminado: ${item.name}`)
    } catch (error) {
      overlays.close()
      setStatus(error instanceof Error ? error.message : "No se pudo eliminar el elemento.")
    }
  }

  function requestDeletion() {
    const item = explorer.selectedItem()
    if (item) overlays.requestDeletion(item)
  }

  const commands = (): Command[] => [
    { title: "Abrir explorador", shortcut: "Ctrl+B", run: focusExplorer },
    { title: "Actualizar explorador", shortcut: "F5", run: () => void explorer.refreshExplorer() },
    { title: "Crear archivo en carpeta seleccionada", shortcut: "Ctrl+N", run: () => openOverlay("new-file") },
    { title: "Buscar texto", shortcut: "Ctrl+F", run: editor.openFind },
    { title: "Buscar en todo el proyecto", shortcut: "Ctrl+Alt+F", run: () => openOverlay("project-search") },
    { title: "Guardar archivo", shortcut: "Ctrl+S", run: () => void documents.save() },
    { title: "Cerrar archivo", shortcut: "Ctrl+W", run: requestClose },
    { title: "Pestaña siguiente", shortcut: "Shift+Tab", run: () => documents.changeTab(1) },
    { title: "Copiar selección", shortcut: "Ctrl+C", run: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)) },
    { title: "Pegar portapapeles", shortcut: "Ctrl+V", run: () => void editor.paste() },
    { title: "Alternar línea completa", shortcut: "Ctrl+L", run: toggleWrap },
    { title: "Deshacer último cambio", shortcut: "Ctrl+Z", run: editor.undo },
    { title: "Rehacer último cambio", shortcut: "Ctrl+Shift+Z", run: editor.redo },
    { title: "Calcular líneas del proyecto", shortcut: "Paleta", run: () => void search.showProjectLineCount() },
    { title: `Configuración: ajuste de línea ${editor.wrapMode() === "word" ? "activado" : "desactivado"}`, shortcut: "Ctrl+Alt+W", run: toggleWrap },
  ]

  function acceptCommand() {
    const command = search.paletteResults(commands())[search.searchIndex()]
    if (!command) return
    overlays.close()
    command.run()
  }

  async function openProjectResult() {
    const result = search.projectResults()[search.searchIndex()]
    if (!result) return search.findInProject()
    overlays.close()
    await documents.openFile(result.path)
    editor.gotoLine(result.line - 1)
  }

  function cancelProjectSearch() {
    overlays.close()
    search.reset()
  }

  function focusExplorer() {
    if (active() === "explorer" && documents.filePath()) {
      setActive("editor")
      setStatus("Editor activo.")
      return
    }
    setExplorerVisible(true)
    setActive("explorer")
    setStatus("Explorador activo. Flechas para seleccionar, Enter para abrir, Shift+Enter para contraer.")
  }

  function toggleWrap() { editor.setLineWrap(editor.wrapMode() === "none" ? "word" : "none") }
  function moveExplorerSelection(direction: number) { explorer.moveSelection(direction) }
  async function collapseExplorerItem() {
    const item = explorer.selectedItem()
    if (item?.directory && item.expanded) await explorer.activateItem(item)
  }

  useKeyboardShortcuts({
    active, setActive, overlay: overlays.overlay, pendingDeletion: overlays.pendingDeletion, setConfirmChoice: overlays.setConfirmChoice, searchIndex: search.searchIndex, setSearchIndex: search.setSearchIndex,
    closeOverlay: overlays.close, cancelProjectSearch, acceptConfirm, acceptDeletion, quit, refreshExplorer: explorer.refreshExplorer, save: documents.save, undo: editor.undo, redo: editor.redo,
    openPalette: () => openOverlay("command-palette"), openNewFile: () => openOverlay("new-file"), openProjectSearch: () => openOverlay("project-search"), openTextSearch: editor.openFind, editorFindOpen: editor.findOpen, moveEditorFindResult: editor.moveFindResult, acceptEditorFind: editor.acceptFind, closeEditorFind: editor.closeFind,
    focusExplorer, changeTab: () => documents.changeTab(1), toggleWrap, requestClose, copy: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)), paste: editor.paste,
    paletteLength: () => search.paletteResults(commands()).length, acceptCommand, createNewFile, projectResultsLength: () => search.projectResults().length,
    openProjectResult, findInProject: search.findInProject, collapseAllFolders: explorer.collapseAllFolders, collapseSelectedFolder: explorer.collapseSelectedFolder,
    moveExplorerSelection, activateExplorerItem: explorer.activateItem, collapseExplorerItem, requestDeletion,
  })

  createEffect(() => explorerScroll?.scrollTo({ x: explorerScroll.scrollLeft, y: Math.max(0, explorer.selected() - 4) }))
  onMount(() => { renderer.on("frame", editor.metrics.syncScroll); onCleanup(() => renderer.off("frame", editor.metrics.syncScroll)) })

  return {
    root, rootName: () => basename(root) || root, rootParent: () => dirname(root), active, explorerVisible, status, explorer, documents, editor, overlays, search,
    title: () => documents.filePath() ? displayPath(root, documents.filePath()!) : "Sin archivo abierto",
    paletteResults: () => search.paletteResults(commands()), setExplorerScroll: (value: ScrollBoxRenderable) => { explorerScroll = value },
  }
}
