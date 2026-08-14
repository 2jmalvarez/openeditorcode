import type { ScrollBoxRenderable } from "@opentui/core"
import { APP_VERSION } from "../bootstrap/version"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { basename } from "node:path"
import type { Command } from "../dialogs/types"
import { useOverlays } from "../dialogs/useOverlays"
import { useDocuments } from "../documents/useDocuments"
import { useEditor } from "../editor/useEditor"
import { useExplorer } from "../explorer/useExplorer"
import { useGit } from "../git/useGit"
import { displayPath } from "../explorer/tree"
import { removeProjectEntry } from "../documents/files"
import { useSearch } from "../search/useSearch"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"
import type { FocusTarget } from "./types"
import { useUpdates } from "../updates/useUpdates"
import { refreshFocusedPanel } from "./refresh"
import { useActivity } from "./useActivity"

export function useWorkbench(root: string) {
  const renderer = useRenderer()
  const [active, setActive] = createSignal<FocusTarget>("explorer")
  const [explorerVisible, setExplorerVisible] = createSignal(true)
  const [gitVisible, setGitVisible] = createSignal(false)
  const [status, setStatus] = createSignal("Explorador listo")
  const activity = useActivity()
  let explorerScroll: ScrollBoxRenderable | undefined
  let gitScroll: ScrollBoxRenderable | undefined
  let exclusionsReturn: "project-search" | "file-search" = "file-search"
  const overlays = useOverlays()
  const editor = useEditor({ active, overlay: overlays.overlay, filePath: () => documents.filePath(), setStatus })
  const documents = useDocuments({
    root,
    content: editor.content,
    getText: editor.currentText,
    setText: editor.setText,
    clearEditor: editor.clear,
    blurEditor: editor.blur,
    focusEditor: () => setActive("editor"),
    focusExplorer: () => { setExplorerVisible(true); setActive("explorer") },
    setStatus,
  })
  const openDocument = (path: string) => activity.run("Abriendo archivo...", () => documents.openFile(path))
  const saveDocument = () => activity.run("Guardando archivo...", documents.save)
  const explorer = useExplorer({ root, setStatus, openFile: openDocument })
  const search = useSearch({ root, setStatus, runActivity: activity.run })
  const git = useGit({ root, setStatus, runActivity: activity.run })
  const updates = useUpdates()

  createEffect(() => documents.syncContent(editor.content()))

  function openOverlay(kind: "command-palette" | "project-search" | "new-file") {
    overlays.open(kind, kind === "new-file" ? explorer.newFileDirectory() : undefined)
    if (kind !== "project-search") search.reset()
  }

  function requestClose() {
    if (documents.dirty()) {
      overlays.requestConfirm("close")
      setStatus("Hay cambios sin guardar.")
      return
    }
    documents.closeFile()
  }

  function requestCloseTab(index: number) {
    documents.activateTab(index)
    requestClose()
  }

  function quit() {
    if (documents.hasDirtyTabs()) {
      overlays.requestConfirm("quit")
      setStatus("Hay cambios sin guardar.")
      return
    }
    renderer.destroy()
  }

  function performUpdate() {
    process.exitCode = 42
    renderer.destroy()
  }

  function requestUpdate() {
    if (documents.hasDirtyTabs()) {
      overlays.requestConfirm("update")
      setStatus("Guarda o descarta los cambios antes de actualizar OEC.")
      return
    }
    performUpdate()
  }

  async function acceptConfirm() {
    const choice = overlays.confirmChoice()
    const action = overlays.pendingAction()
    if (choice < 2) {
      const saved = action === "close" ? await documents.save() : await documents.saveAllDirtyTabs()
      if (!saved) return
    }
    overlays.close()
    if (choice === 0) return
    if (choice === 2) setStatus("Cambios descartados.")
    if (action === "close") documents.closeFile()
    if (action === "quit") renderer.destroy()
    if (action === "update") performUpdate()
  }

  async function createNewFile() {
    await activity.run("Creando archivo...", async () => {
      if (await documents.createFile(overlays.newFileDirectory(), overlays.newFileName().trim(), explorer.refreshTree)) {
        search.invalidateIndex()
        overlays.close()
      }
    })
  }

  async function acceptDeletion() {
    const item = overlays.pendingDeletion()
    if (!item) return overlays.close()
    if (documents.hasDirtyTabsAffectedBy(item.path, item.directory)) {
      overlays.close()
      setStatus("No se puede eliminar: hay cambios sin guardar en una pestaña afectada.")
      return
    }
    await activity.run("Eliminando elemento...", async () => {
      try {
        await removeProjectEntry(root, item.path)
        documents.closeTabsAffectedBy(item.path, item.directory)
        await explorer.refreshTree()
        search.invalidateIndex()
        overlays.close()
        setStatus(`${item.directory ? "Carpeta" : "Archivo"} eliminado: ${item.name}`)
      } catch (error) {
        overlays.close()
        setStatus(error instanceof Error ? error.message : "No se pudo eliminar el elemento.")
      }
    })
  }

  function requestDeletion() {
    const item = explorer.selectedItem()
    if (item) overlays.requestDeletion(item)
  }

  async function refreshExplorer() {
    await activity.run("Actualizando explorador...", async () => {
      await search.reloadExclusions()
      await explorer.refreshExplorer()
      await search.refreshFileSearch()
    })
  }

  async function refreshActivePanel() {
    await refreshFocusedPanel(active(), refreshExplorer, git.fetch)
  }

  const commands = (): Command[] => [
    { title: "Mover foco a la izquierda", shortcut: "Ctrl+Shift+←", run: focusLeft },
    { title: "Mover foco a la derecha", shortcut: "Ctrl+Shift+→", run: focusRight },
    { title: "Mostrar u ocultar explorador", shortcut: "Ctrl+B", run: toggleExplorer },
    { title: "Mostrar u ocultar control de cambios", shortcut: "Ctrl+Alt+B", run: toggleGit },
    { title: "Actualizar referencias remotas y cambios de Git", shortcut: "Paleta", run: () => void git.fetch() },
    { title: "Actualizar panel activo", shortcut: "F5", run: () => void refreshActivePanel() },
    { title: "Crear archivo en carpeta seleccionada", shortcut: "Ctrl+N", run: () => openOverlay("new-file") },
    { title: active() === "explorer" ? "Buscar archivo por nombre" : "Buscar texto", shortcut: "Ctrl+F", run: openContextSearch },
    { title: "Buscar en todo el proyecto", shortcut: "Ctrl+Alt+F", run: () => openOverlay("project-search") },
    { title: "Editar exclusiones de búsqueda", shortcut: "Ctrl+E en buscador", run: openSearchExclusions },
    { title: "Guardar archivo", shortcut: "Ctrl+S", run: () => void saveDocument() },
    { title: "Cerrar archivo", shortcut: "Ctrl+W", run: requestClose },
    { title: "Pestaña siguiente", shortcut: "Shift+Tab", run: () => documents.changeTab(1) },
    { title: "Copiar selección", shortcut: "Ctrl+C", run: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)) },
    { title: "Pegar portapapeles", shortcut: "Ctrl+V", run: () => void editor.paste() },
    { title: "Alternar ajuste de línea", shortcut: "Ctrl+L", run: toggleWrap },
    { title: "Deshacer último cambio", shortcut: "Ctrl+Z", run: editor.undo },
    { title: "Rehacer último cambio", shortcut: "Ctrl+Shift+Z", run: editor.redo },
    { title: "Calcular líneas del proyecto", shortcut: "Paleta", run: () => void search.showProjectLineCount() },
    { title: `Configuración: ajuste de línea ${editor.wrapMode() === "word" ? "activado" : "desactivado"}`, shortcut: "Ctrl+Alt+W", run: toggleWrap },
    ...(updates.canUpdate() ? [{ title: `Actualizar OEC a v${updates.latestVersion()}`, shortcut: "Actualización", run: requestUpdate }] : []),
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
    if (await openDocument(result.path)) editor.gotoLine(result.line - 1)
  }

  function cancelProjectSearch() {
    overlays.close()
    search.reset()
  }

  function openContextSearch() {
    if (active() === "explorer") {
      editor.closeFind()
      search.openFileSearch()
      return
    }
    search.closeFileSearch()
    editor.openFind()
  }

  function openSearchExclusions() {
    exclusionsReturn = overlays.overlay() === "project-search" ? "project-search" : "file-search"
    overlays.open("search-exclusions")
    void search.prepareExclusions()
  }

  function closeSearchExclusions() {
    if (exclusionsReturn === "project-search") overlays.open("project-search")
    else overlays.close()
  }

  async function openFileSearchResult(index = search.fileSearchIndex()) {
    const result = search.fileResults()[index]
    if (!result) return
    search.setFileSearchIndex(index)
    search.closeFileSearch()
    await openDocument(result.path)
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

  function focusEditor() {
    setActive("editor")
    setStatus("Editor activo.")
  }

  function focusLeft() {
    if (active() === "git") return focusEditor()
    if (active() === "editor") return focusExplorer()
  }

  function focusRight() {
    if (active() === "explorer") return focusEditor()
    if (active() === "editor") {
      setGitVisible(true)
      setActive("git")
      setStatus("Control de cambios activo. Flechas para seleccionar, Enter para ver el diff.")
    }
  }

  function toggleExplorer() {
    setExplorerVisible((visible) => !visible)
    if (explorerVisible()) {
      setActive("explorer")
      setStatus("Explorador visible.")
    } else {
      setActive("editor")
      setStatus("Explorador oculto.")
    }
  }

  function toggleGit() {
    setGitVisible((visible) => !visible)
    if (gitVisible()) {
      setActive("git")
      setStatus("Control de cambios visible.")
    } else {
      setActive("editor")
      setStatus("Control de cambios oculto.")
    }
  }

  function cycleFocus() {
    if (active() === "explorer") return focusEditor()
    if (active() === "editor") return focusRight()
    return focusExplorer()
  }

  function activateExplorerAt(index: number) {
    setExplorerVisible(true)
    setActive("explorer")
    setStatus("Explorador activo. Flechas para seleccionar, Enter para abrir, Shift+Enter para contraer.")
    void explorer.activateAt(index)
  }

  async function activateGitAt(index: number) {
    setGitVisible(true)
    setActive("git")
    git.selected() !== index && git.moveSelection(index - git.selected())
    if (git.toggleSelectedFolder()) return
    const diff = await git.openSelected()
    if (diff) {
      documents.openDiff(diff)
      setActive("git")
    }
  }

  function toggleWrap() { editor.setLineWrap(editor.wrapMode() === "none" ? "word" : "none") }
  function moveExplorerSelection(direction: number) { explorer.moveSelection(direction) }
  async function collapseExplorerItem() {
    const item = explorer.selectedItem()
    if (item?.directory && item.expanded) await explorer.activateItem(item)
  }

  useKeyboardShortcuts({
    active, overlay: overlays.overlay, setConfirmChoice: overlays.setConfirmChoice, searchIndex: search.searchIndex, setSearchIndex: search.setSearchIndex,
    closeOverlay: overlays.close, cancelProjectSearch, acceptConfirm, acceptDeletion, quit, refreshActivePanel, save: saveDocument, undo: editor.undo, redo: editor.redo,
    openPalette: () => openOverlay("command-palette"), openNewFile: () => openOverlay("new-file"), openProjectSearch: () => openOverlay("project-search"), openTextSearch: openContextSearch, editorFindOpen: editor.findOpen, moveEditorFindResult: editor.moveFindResult, acceptEditorFind: editor.acceptFind, closeEditorFind: editor.closeFind,
    focusLeft, focusRight, toggleExplorer, toggleGit, changeTab: () => documents.changeTab(1), cycleFocus, toggleWrap, requestClose, copy: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)), paste: editor.paste,
    paletteLength: () => search.paletteResults(commands()).length, acceptCommand, createNewFile, projectResultsLength: () => search.projectResults().length,
    openProjectResult, findInProject: search.findInProject, collapseAllFolders: explorer.collapseAllFolders, collapseSelectedFolder: explorer.collapseSelectedFolder,
    moveExplorerSelection, activateExplorerItem: explorer.activateItem, collapseExplorerItem, requestDeletion, moveGitSelection: git.moveSelection, activateGitItem: async () => { if (git.toggleSelectedFolder()) return; const diff = await git.openSelected(); if (diff) { documents.openDiff(diff); setActive("git") } }, collapseGitItem: () => { git.toggleSelectedFolder() }, collapseAllGitFolders: git.collapseAllFolders,
    openFileSearch: openContextSearch, fileSearchOpen: search.fileSearchOpen, closeFileSearch: search.closeFileSearch, moveFileSearchSelection: search.moveFileSelection, fileSearchResultsLength: () => search.fileResults().length, openFileSearchResult,
    openSearchExclusions, closeSearchExclusions, exclusionSuggestionsLength: () => search.exclusionSuggestions().length, exclusionIndex: search.exclusionIndex, setExclusionIndex: search.setExclusionIndex, completeExclusion: search.completeExclusion, toggleExclusion: search.toggleExclusion, removeExclusion: search.removeExclusion,
  })

  createEffect(() => explorerScroll?.scrollTo({ x: explorerScroll.scrollLeft, y: Math.max(0, (search.fileSearchOpen() ? search.fileSearchIndex() : explorer.selected()) - 4) }))
  createEffect(() => gitScroll?.scrollTo({ x: gitScroll.scrollLeft, y: Math.max(0, git.selected() - 4) }))
  onMount(() => { renderer.on("frame", editor.metrics.syncScroll); onCleanup(() => renderer.off("frame", editor.metrics.syncScroll)) })

  return {
    root, appVersion: APP_VERSION, rootName: () => basename(root) || root, active, explorerVisible, gitVisible, status, activity, explorer, git, documents, editor, overlays, search, updates,
    title: () => documents.filePath() ? displayPath(root, documents.filePath()!) : documents.activeDiff()?.file.path ? `Cambios: ${documents.activeDiff()!.file.path}` : "Sin archivo abierto", activateExplorerAt, activateGitAt, openFileSearchResult, requestCloseTab,
    paletteResults: () => search.paletteResults(commands()), setExplorerScroll: (value: ScrollBoxRenderable) => { explorerScroll = value }, setGitScroll: (value: ScrollBoxRenderable) => { gitScroll = value },
  }
}
