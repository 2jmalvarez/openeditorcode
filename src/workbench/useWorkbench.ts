import type { ScrollBoxRenderable } from "@opentui/core"
import { APP_VERSION } from "../bootstrap/version"
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { basename, join } from "node:path"
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
import { canShowBothSidePanels, initialSidePanels } from "./layout"
import type { ConfigPaths, ConfigRecovery, OecConfig } from "../config/types"
import { readConfigText, saveConfig } from "../config/storage"
import { markConfigHealthy, markConfigStarting } from "../config/storage"
import { serializeConfig } from "../config/defaults"
import { oecManual } from "../docs/manual"
import { configureLanguage, language, t } from "../localization"

export function useWorkbench(root: string, initialConfig: OecConfig, configPaths: ConfigPaths, recovery?: ConfigRecovery) {
  const renderer = useRenderer()
  const [config, setConfig] = createSignal(initialConfig)
  const initialPanels = initialSidePanels(renderer.width, initialConfig)
  const [active, setActive] = createSignal<FocusTarget>(initialPanels.explorer ? "explorer" : "editor")
  const [explorerVisible, setExplorerVisible] = createSignal(initialPanels.explorer)
  const [gitVisible, setGitVisible] = createSignal(initialPanels.changes)
  const [status, setStatus] = createSignal(recovery ? `${t("config.restored")}. Backup: ${recovery.backup}` : t("app.explorer"))
  const activity = useActivity()
  let explorerScroll: ScrollBoxRenderable | undefined
  let gitScroll: ScrollBoxRenderable | undefined
  let exclusionsReturn: "project-search" | "file-search" = "file-search"
  const overlays = useOverlays()
  const editor = useEditor({ active, overlay: overlays.overlay, filePath: () => documents.filePath(), setStatus, wrapMode: initialConfig.editor.wrap })
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
    readConfig: async () => (await readConfigText(configPaths)) ?? "",
    writeConfig: async (content) => {
      const next = await saveConfig(configPaths, content)
      if (process.env.OEC_CONFIG_ATTEMPT_ID) {
        await markConfigStarting(configPaths, process.env.OEC_CONFIG_ATTEMPT_ID, serializeConfig(next))
        renderer.once("frame", () => void markConfigHealthy(configPaths, process.env.OEC_CONFIG_ATTEMPT_ID!))
      }
      setConfig(next)
      configureLanguage(next.appearance.language)
      editor.setLineWrap(next.editor.wrap)
    },
    markdownDefault: initialConfig.preview.markdownDefault,
    imagesEnabled: initialConfig.preview.images,
  })
  const openDocument = (path: string) => activity.run("Abriendo archivo...", () => documents.openFile(path))
  const saveDocument = () => activity.run("Guardando archivo...", documents.save)
  const explorer = useExplorer({ root, setStatus, openFile: openDocument })
  const search = useSearch({ root, setStatus, runActivity: activity.run, respectGitignore: initialConfig.search.respectGitignore })
  const git = useGit({ root, setStatus, runActivity: activity.run, autoRefresh: initialConfig.git.autoRefresh, fetchOnRefresh: initialConfig.git.fetchOnRefresh })
  const updates = useUpdates(initialConfig.updates.checkOnStartup)

  createEffect(on(editor.content, documents.syncContent, { defer: true }))

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

  async function stageGitItem() {
    if (await git.stageSelected()) setStatus("Archivo preparado.")
  }

  async function unstageGitItem() {
    if (await git.unstageSelected()) setStatus("Archivo retirado del área preparada.")
  }

  function requestGitRevert() {
    const file = git.selectedFile()
    if (!file) return
    if (file.area === "staged") return void unstageGitItem()
    overlays.requestGitRevert(file)
  }

  async function acceptGitRevert() {
    const file = overlays.pendingGitRevert()
    if (!file) return overlays.close()
    try {
      const discarded = file.status === "untracked"
        ? await removeProjectEntry(root, join(root, file.path)).then(() => git.refresh()).then(() => true)
        : await git.restoreSelected()
      setStatus(discarded ? "Cambios descartados." : "No se pudieron descartar los cambios.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudieron descartar los cambios.")
    }
    overlays.close()
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
    { title: t("command.focusLeft"), shortcut: "Ctrl+Shift+←", run: focusLeft },
    { title: t("command.focusRight"), shortcut: "Ctrl+Shift+→", run: focusRight },
    { title: t("command.toggleExplorer"), shortcut: "Ctrl+B", run: toggleExplorer },
    { title: t("command.toggleGit"), shortcut: "Ctrl+Alt+B", run: toggleGit },
    { title: t("command.refreshGit"), shortcut: t("command.palette"), run: () => void git.fetch() },
    { title: t("command.refresh"), shortcut: "F5", run: () => void refreshActivePanel() },
    { title: t("command.create"), shortcut: "Ctrl+N", run: () => openOverlay("new-file") },
    { title: active() === "explorer" ? t("command.searchFile") : t("command.searchText"), shortcut: "Ctrl+F", run: openContextSearch },
    { title: t("command.searchProject"), shortcut: "Ctrl+Alt+F", run: () => openOverlay("project-search") },
    { title: t("command.exclusions"), shortcut: "Ctrl+E", run: openSearchExclusions },
    { title: t("command.config"), shortcut: t("command.palette"), run: () => void openOecConfig() },
    { title: t("command.manual"), shortcut: t("command.palette"), run: openManual },
    { title: documents.activePreview() ? "Editar Markdown" : "Ver preview Markdown", shortcut: "F4", run: documents.togglePreview },
    { title: t("command.save"), shortcut: "Ctrl+S", run: () => void saveDocument() },
    { title: t("command.close"), shortcut: "Ctrl+W", run: requestClose },
    { title: t("command.nextTab"), shortcut: "Shift+Tab", run: () => documents.changeTab(1) },
    { title: t("command.copy"), shortcut: "Ctrl+C", run: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)) },
    { title: t("command.paste"), shortcut: "Ctrl+V", run: () => void editor.paste() },
    { title: t("command.wrap"), shortcut: "Ctrl+L", run: toggleWrap },
    { title: t("command.undo"), shortcut: "Ctrl+Z", run: editor.undo },
    { title: t("command.redo"), shortcut: "Ctrl+Shift+Z", run: editor.redo },
    { title: t("command.countLines"), shortcut: t("command.palette"), run: () => void search.showProjectLineCount() },
    { title: `Configuración: ajuste de línea ${editor.wrapMode() === "word" ? "activado" : "desactivado"}`, shortcut: "Ctrl+Alt+W", run: toggleWrap },
    ...(updates.canUpdate() ? [{ title: `Actualizar OEC a v${updates.latestVersion()}`, shortcut: t("command.update"), run: requestUpdate }] : []),
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

  async function openOecConfig() {
    await activity.run("Abriendo configuración de OEC...", () => documents.openConfig(configPaths.file))
  }

  function openManual() { documents.openManual("MANUAL.md", oecManual(language())) }

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
    if (!canShowBothSidePanels(renderer.width, config().layout)) setGitVisible(false)
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
      if (!canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
      setGitVisible(true)
      setActive("git")
      setStatus("Control de cambios activo. Flechas para seleccionar, Enter para ver el diff.")
    }
  }

  function toggleExplorer() {
    const visible = !explorerVisible()
    if (visible && !canShowBothSidePanels(renderer.width, config().layout)) setGitVisible(false)
    setExplorerVisible(visible)
    if (visible) {
      setActive("explorer")
      setStatus("Explorador visible.")
    } else {
      setActive("editor")
      setStatus("Explorador oculto.")
    }
  }

  function toggleGit() {
    const visible = !gitVisible()
    if (visible && !canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
    setGitVisible(visible)
    if (visible) {
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
    if (!canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
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
    closeOverlay: overlays.close, cancelProjectSearch, acceptConfirm, acceptDeletion, acceptGitRevert, quit, refreshActivePanel, save: saveDocument, undo: editor.undo, redo: editor.redo,
    openPalette: () => openOverlay("command-palette"), openNewFile: () => openOverlay("new-file"), openProjectSearch: () => openOverlay("project-search"), openTextSearch: openContextSearch, editorFindOpen: editor.findOpen, moveEditorFindResult: editor.moveFindResult, acceptEditorFind: editor.acceptFind, closeEditorFind: editor.closeFind,
    focusLeft, focusRight, toggleExplorer, toggleGit, changeTab: () => documents.changeTab(1), cycleFocus, toggleWrap, togglePreview: documents.togglePreview, requestClose, copy: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)), paste: editor.paste,
    paletteLength: () => search.paletteResults(commands()).length, acceptCommand, createNewFile, projectResultsLength: () => search.projectResults().length,
    openProjectResult, findInProject: search.findInProject, collapseAllFolders: explorer.collapseAllFolders, collapseSelectedFolder: explorer.collapseSelectedFolder,
    moveExplorerSelection, activateExplorerItem: explorer.activateItem, collapseExplorerItem, requestDeletion, moveGitSelection: git.moveSelection, activateGitItem: async () => { if (git.toggleSelectedFolder()) return; const diff = await git.openSelected(); if (diff) { documents.openDiff(diff); setActive("git") } }, collapseGitItem: () => { git.toggleSelectedFolder() }, collapseAllGitFolders: git.collapseAllFolders, stageGitItem, unstageGitItem, requestGitRevert,
    openFileSearch: openContextSearch, fileSearchOpen: search.fileSearchOpen, closeFileSearch: search.closeFileSearch, moveFileSearchSelection: search.moveFileSelection, fileSearchResultsLength: () => search.fileResults().length, openFileSearchResult,
    openSearchExclusions, closeSearchExclusions, exclusionSuggestionsLength: () => search.exclusionSuggestions().length, exclusionIndex: search.exclusionIndex, setExclusionIndex: search.setExclusionIndex, completeExclusion: search.completeExclusion, toggleExclusion: search.toggleExclusion, removeExclusion: search.removeExclusion,
  })

  createEffect(() => explorerScroll?.scrollTo({ x: explorerScroll.scrollLeft, y: Math.max(0, (search.fileSearchOpen() ? search.fileSearchIndex() : explorer.selected()) - 4) }))
  createEffect(() => gitScroll?.scrollTo({ x: gitScroll.scrollLeft, y: Math.max(0, git.selected() - 4) }))
  function syncSidePanelsToWidth() {
    if (canShowBothSidePanels(renderer.width, config().layout) || !explorerVisible() || !gitVisible()) return
    setGitVisible(false)
    if (active() === "git") setActive("explorer")
  }
  onMount(() => { renderer.on("resize", syncSidePanelsToWidth); onCleanup(() => renderer.off("resize", syncSidePanelsToWidth)) })
  onMount(() => { renderer.on("frame", editor.metrics.syncScroll); onCleanup(() => renderer.off("frame", editor.metrics.syncScroll)) })

  return {
    root, recovery, appVersion: APP_VERSION, rootName: () => basename(root) || root, active, explorerVisible, gitVisible, status, config, activity, explorer, git, documents, editor, overlays, search, updates,
    title: () => documents.filePath() ? displayPath(root, documents.filePath()!) : documents.activeDiff()?.file.path ? `Cambios: ${documents.activeDiff()!.file.path}` : "Sin archivo abierto", activateExplorerAt, activateGitAt, openFileSearchResult, requestCloseTab,
    paletteResults: () => search.paletteResults(commands()), setExplorerScroll: (value: ScrollBoxRenderable) => { explorerScroll = value }, setGitScroll: (value: ScrollBoxRenderable) => { gitScroll = value },
  }
}
