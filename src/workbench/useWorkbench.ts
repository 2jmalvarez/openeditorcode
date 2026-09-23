import type { ScrollBoxRenderable } from "@opentui/core"
import { APP_VERSION } from "../bootstrap/version"
import { createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { basename, join } from "node:path"
import type { Command } from "../dialogs/types"
import { useOverlays } from "../dialogs/useOverlays"
import { useDocuments } from "../documents/useDocuments"
import { useEditor } from "../editor/useEditor"
import { useExplorer } from "../explorer/useExplorer"
import { useGit } from "../git/useGit"
import { displayPath } from "../explorer/tree"
import { removeProjectEntry, renameProjectEntry } from "../documents/files"
import { useSearch } from "../search/useSearch"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"
import type { FocusTarget } from "./types"
import { useUpdates } from "../updates/useUpdates"
import { refreshFocusedPanel } from "./refresh"
import { useActivity } from "./useActivity"
import { useLogs } from "../logs/useLogs"
import { canShowBothSidePanels, initialSidePanels } from "./layout"
import type { ConfigPaths, ConfigRecovery, OecConfig, ProjectConfig } from "../config/types"
import { loadProjectConfig, projectConfigPath, readConfigText, resolveConfig, saveConfig, saveProjectConfig } from "../config/storage"
import { markConfigHealthy, markConfigStarting } from "../config/storage"
import { serializeConfig } from "../config/defaults"
import { oecManual } from "../docs/manual"
import { configureLanguage, language, t, translateKnown } from "../localization"
import { createSyntaxTheme } from "../editor/syntax"
import { formatDocument } from "../editor/format"
import { bindingLabel } from "./keybindings"
import { openProjectFolder } from "./openProjectFolder"

export function useWorkbench(root: string, initialConfig: OecConfig, configPaths: ConfigPaths, recovery?: ConfigRecovery, initialGlobalConfig = initialConfig, initialProjectConfig?: ProjectConfig, initialProjectConfigPath = projectConfigPath(root)) {
  const renderer = useRenderer()
  const [globalConfig, setGlobalConfig] = createSignal(initialGlobalConfig)
  const [projectConfig, setProjectConfig] = createSignal(initialProjectConfig)
  const config = createMemo(() => resolveConfig(globalConfig(), projectConfig()))
  const syntaxTheme = createMemo(() => createSyntaxTheme(config().editor.syntax.styles))
  const initialPanels = initialSidePanels(renderer.width, initialConfig)
  const [active, setActive] = createSignal<FocusTarget>(initialPanels.explorer ? "explorer" : "editor")
  const [explorerVisible, setExplorerVisible] = createSignal(initialPanels.explorer)
  const [gitVisible, setGitVisible] = createSignal(initialPanels.changes)
  const [statusText, setStatusText] = createSignal(recovery ? t("app.backup", { heading: t("config.restored"), path: recovery.backup }) : t("app.explorer"))
  const [statusLanguage, setStatusLanguage] = createSignal(language())
  const setStatus = (message: string) => { setStatusText(message); setStatusLanguage(language()) }
  const status = () => {
    language()
    return statusLanguage() === language() ? statusText() : translateKnown(statusText())
  }
  const activity = useActivity()
  const logs = useLogs()
  let explorerScroll: ScrollBoxRenderable | undefined
  let gitScroll: ScrollBoxRenderable | undefined
  let exclusionsReturn: "project-search" | "file-search" = "file-search"
  const overlays = useOverlays()
  const editor = useEditor({ active, overlay: overlays.overlay, filePath: () => documents.filePath(), setStatus, wrapMode: initialConfig.editor.wrap, syntaxTheme, vimEnabled: () => config().keyboard.profile === "vim" })
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
    reportError: logs.report,
    readConfig: async () => (await readConfigText(configPaths)) ?? "",
    writeConfig: async (source, content) => {
      const next = source === "config-global" ? await saveConfig(configPaths, content) : await saveProjectConfig(root, content)
      if (process.env.OEC_CONFIG_ATTEMPT_ID) {
        await markConfigStarting(configPaths, process.env.OEC_CONFIG_ATTEMPT_ID, serializeConfig(config()))
        renderer.once("frame", () => void markConfigHealthy(configPaths, process.env.OEC_CONFIG_ATTEMPT_ID!))
      }
      if (source === "config-global") setGlobalConfig(next as OecConfig)
      else setProjectConfig(next as ProjectConfig)
      const effective = resolveConfig(source === "config-global" ? next as OecConfig : globalConfig(), source === "config-project" ? next as ProjectConfig : projectConfig())
      configureLanguage(effective.appearance.language)
      editor.setLineWrap(effective.editor.wrap)
    },
    markdownDefault: initialConfig.preview.markdownDefault,
    imagesEnabled: initialConfig.preview.images,
  })
  const openDocument = (path: string) => activity.run(t("activity.openFile"), () => documents.openFile(path))
  async function saveDocument() {
    if (config().editor.formatting.formatOnSave) await formatActiveDocument()
    const saved = await activity.run(t("activity.saveFile"), documents.save)
    const changedPath = documents.externalChange()
    if (!saved && changedPath) overlays.requestExternalChange(changedPath)
    return saved
  }

  async function formatActiveDocument(): Promise<boolean> {
    const path = documents.activeProjectFile()
    if (!path) { setStatus(t("status.formatUnavailable")); return false }
    const source = editor.currentText()
    try {
      const formatted = await activity.run(t("activity.format"), () => formatDocument(path, source, config()))
      if (documents.activeProjectFile() !== path || editor.currentText() !== source) { setStatus(t("status.formatChanged")); return false }
      if (formatted === undefined) { setStatus(t("status.noFormatter")); return false }
      if (!editor.replaceCurrentText(formatted)) { setStatus(t("status.alreadyFormatted")); return true }
      setStatus(t("status.formatted"))
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("status.formatFailed"))
      return false
    }
  }
  const search = useSearch({ root, setStatus, runActivity: activity.run, respectGitignore: initialConfig.search.respectGitignore, reportError: logs.report })
  const explorer = useExplorer({ root, setStatus, openFile: openDocument, massiveFiles: search.massiveFiles, reportError: logs.report })
  const git = useGit({ root, setStatus, runActivity: activity.run, autoRefresh: initialConfig.git.autoRefresh, fetchOnRefresh: initialConfig.git.fetchOnRefresh, reportFailure: logs.report })
  const updates = useUpdates(initialConfig.updates.checkOnStartup)

  createEffect(on(editor.content, documents.syncContent, { defer: true }))
  createEffect(() => { if (documents.activeLogs()) logs.markRead() })

  function openOverlay(kind: "command-palette" | "project-search" | "new-file") {
    overlays.open(kind, kind === "new-file" ? explorer.newFileDirectory() : undefined)
    if (kind !== "project-search") search.reset()
  }

  function requestClose() {
    if (documents.dirty()) {
      overlays.requestConfirm("close")
      setStatus(t("status.unsaved"))
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
      setStatus(t("status.unsaved"))
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
      setStatus(t("status.updateUnsaved"))
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
    if (choice === 2) setStatus(t("status.discarded"))
    if (action === "close") documents.closeFile()
    if (action === "quit") renderer.destroy()
    if (action === "update") performUpdate()
  }

  async function createNewFile() {
    await activity.run(t("activity.createFile"), async () => {
      if (await documents.createFile(overlays.newFileDirectory(), overlays.newFileName().trim(), async () => { await explorer.refreshTree() })) {
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
      setStatus(t("status.deleteBlocked"))
      return
    }
    await activity.run(t("activity.delete"), async () => {
      try {
        await removeProjectEntry(root, item.path)
        documents.closeTabsAffectedBy(item.path, item.directory)
        await explorer.refreshTree()
        search.invalidateIndex()
        overlays.close()
        setStatus(t(item.directory ? "status.deletedFolder" : "status.deletedFile", { name: item.name }))
      } catch (error) {
        overlays.close()
        const summary = error instanceof Error ? error.message : t("status.deleteFailed")
        setStatus(summary)
        logs.report({ source: t("log.files"), operation: t("log.delete"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
      }
    })
  }

  function requestDeletion() {
    const item = explorer.selectedItem()
    if (item) overlays.requestDeletion(item)
  }

  function requestRename() {
    const item = explorer.selectedItem()
    if (item) overlays.requestRename(item)
  }

  async function acceptRename() {
    const item = overlays.pendingRename()
    const name = overlays.renameName().trim()
    if (!item) return overlays.close()
    if (name === item.name) return overlays.close()
    await activity.run(t("activity.rename"), async () => {
      try {
        const nextPath = await renameProjectEntry(root, item.path, name)
        documents.renameTabsAffectedBy(item.path, nextPath, item.directory)
        await explorer.renameItem(item.path, nextPath, item.directory)
        search.invalidateIndex()
        overlays.close()
        setStatus(t("status.renamed", { name }))
      } catch (error) {
        const summary = error instanceof Error ? error.message : t("status.renameFailed")
        setStatus(summary)
        logs.report({ source: t("log.files"), operation: t("log.rename"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
      }
    })
  }

  function revealProjectFolder() {
    try {
      openProjectFolder(root)
      setStatus(t("status.folderOpened"))
    } catch (error) {
      const summary = error instanceof Error ? error.message : t("status.folderOpenFailed")
      setStatus(summary)
      logs.report({ source: t("log.system"), operation: t("log.openFolder"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
    }
  }

  async function stageGitItem() {
    if (await git.stageSelected()) setStatus(t("status.staged"))
  }

  async function unstageGitItem() {
    if (await git.unstageSelected()) setStatus(t("status.unstaged"))
  }

  function requestGitRevert() {
    if (git.mode() !== "local") return
    const files = git.selectedFiles()
    if (!files.length) return
    if (files[0].area === "staged") return void unstageGitItem()
    overlays.requestGitRevert(files)
  }

  async function acceptGitRevert() {
    if (git.mode() !== "local") return overlays.close()
    const files = overlays.pendingGitRevert()
    if (!files.length) return overlays.close()
    if (files.some((file) => documents.hasDirtyTabsAffectedBy(join(root, file.path), false))) {
      overlays.close()
      setStatus(t("status.discardBlocked"))
      return
    }
    try {
      const untracked = files.filter((file) => file.status === "untracked")
      const tracked = files.filter((file) => file.status !== "untracked")
      const removed = await Promise.all(untracked.map(async (file) => removeProjectEntry(root, join(root, file.path))))
      const restored = tracked.length === 0 || await git.restore(tracked)
      const discarded = removed.length === untracked.length && restored
      if (discarded) {
        for (const file of files) documents.closeTabsAffectedBy(join(root, file.path), false)
        if (!tracked.length) await git.refresh()
      }
      setStatus(t(discarded ? "status.discarded" : "status.discardFailed"))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("status.discardFailed"))
    }
    overlays.close()
  }

  async function commitGitChanges() {
    if (git.mode() !== "local") return
    if (!git.commitMessage().trim()) return setStatus(t("status.commitMessage"))
    if (!git.state().files.some((file) => file.area === "staged")) return setStatus(t("status.nothingStaged"))
    setStatus(t(await activity.run(t("activity.commit"), git.commit) ? "status.committed" : "status.commitFailed"))
  }

  async function pullGitChanges() {
    if (git.mode() !== "local") return
    setStatus(t(await activity.run(t("activity.pull"), git.pull) ? "status.pulled" : "status.pullFailed"))
  }

  async function pushGitChanges() {
    if (git.mode() !== "local") return
    setStatus(t(await activity.run(t("activity.push"), git.push) ? "status.pushed" : "status.pushFailed"))
  }

  async function acceptExternalChange() {
    const path = overlays.pendingExternalChange()
    if (!path) return overlays.close()
    const choice = overlays.confirmChoice()
    if (choice === 2) return overlays.close()
    const resolved = choice === 0
      ? await activity.run(t("activity.reload"), () => documents.reloadActiveFile(path))
      : await activity.run(t("activity.overwrite"), () => documents.save(true, path))
    if (resolved) overlays.close()
  }

  async function refreshExplorer() {
    await activity.run(t("activity.explorer"), async () => {
      await search.reloadExclusions()
      await explorer.refreshExplorer()
      await search.refreshFileSearch()
      if (explorer.showMassiveFiles()) await showMassiveFiles()
    })
  }

  async function showMassiveFiles() {
    if (await search.findMassiveFiles()) explorer.showMassiveFilesView()
  }

  function toggleMassiveFiles() {
    if (explorer.showMassiveFiles()) explorer.showTreeView()
    else void showMassiveFiles()
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
    { title: t("command.history"), shortcut: "F8", run: () => void showGitHistory() },
    { title: t("command.branches"), shortcut: "F9", run: () => void showGitBranches() },
    { title: t("command.refresh"), shortcut: "F5", run: () => void refreshActivePanel() },
    { title: t("command.create"), shortcut: "Ctrl+N", run: () => openOverlay("new-file") },
    ...(active() === "explorer" && explorer.selectedItem() ? [{ title: t("command.rename"), shortcut: bindingLabel(config().keyboard.bindings, "explorer.rename", "F2"), run: requestRename }] : []),
    { title: active() === "explorer" ? t("command.searchFile") : t("command.searchText"), shortcut: "Ctrl+F", run: openContextSearch },
    { title: t("command.searchProject"), shortcut: "Ctrl+Alt+F", run: () => openOverlay("project-search") },
    { title: t("command.exclusions"), shortcut: "Ctrl+E", run: openSearchExclusions },
    { title: t("command.settings"), shortcut: t("command.palette"), run: openSettings },
    { title: t("command.config"), shortcut: t("command.palette"), run: () => void openOecConfig() },
    { title: t("command.projectConfig"), shortcut: t("command.palette"), run: () => void openProjectConfig() },
    { title: t("command.manual"), shortcut: t("command.palette"), run: openManual },
    { title: t("command.logs"), shortcut: "F12", run: openLogs },
    { title: t(documents.activeDiff() ? "command.projectFile" : documents.activePreview() ? "command.editMarkdown" : "command.previewMarkdown"), shortcut: "F4", run: () => documents.activeDiff() ? void documents.openActiveDiffFile() : documents.togglePreview() },
    { title: t("command.save"), shortcut: bindingLabel(config().keyboard.bindings, "file.save", "Ctrl+S"), run: () => void saveDocument() },
    { title: t("command.close"), shortcut: bindingLabel(config().keyboard.bindings, "file.close", "Ctrl+W"), run: requestClose },
    { title: t("command.nextTab"), shortcut: "Shift+Tab", run: () => documents.changeTab(1) },
    { title: t("command.copy"), shortcut: "Ctrl+C", run: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)) },
    { title: t("command.paste"), shortcut: "Ctrl+V", run: () => void editor.paste() },
    { title: t("command.wrap"), shortcut: "Ctrl+L", run: toggleWrap },
    { title: t("command.undo"), shortcut: "Ctrl+Z", run: editor.undo },
    { title: t("command.redo"), shortcut: "Ctrl+Shift+Z", run: editor.redo },
    { title: t("command.duplicateAbove"), shortcut: bindingLabel(config().keyboard.bindings, "editor.duplicateLineAbove", "Alt+Shift+Down"), run: () => editor.duplicateLine("above") },
    { title: t("command.duplicateBelow"), shortcut: bindingLabel(config().keyboard.bindings, "editor.duplicateLineBelow", "Alt+Shift+Up"), run: () => editor.duplicateLine("below") },
    { title: t("command.format"), shortcut: bindingLabel(config().keyboard.bindings, "editor.formatDocument", "Alt+Shift+F"), run: () => void formatActiveDocument() },
    { title: t("command.countLines"), shortcut: t("command.palette"), run: () => void search.showProjectLineCount() },
    { title: t("command.massiveFiles"), shortcut: t("command.palette"), run: () => void showMassiveFiles() },
    { title: t("command.openProjectFolder"), shortcut: bindingLabel(config().keyboard.bindings, "app.openProjectFolder", "F10"), run: revealProjectFolder },
    { title: t("command.wrapSetting", { state: t(editor.wrapMode() === "word" ? "settings.enabled" : "settings.disabled").toLowerCase() }), shortcut: "Ctrl+Alt+W", run: toggleWrap },
    ...(updates.canUpdate() ? [{ title: t("command.updateVersion", { version: updates.latestVersion() }), shortcut: t("command.update"), run: requestUpdate }] : []),
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
    await activity.run(t("activity.globalConfig"), () => documents.openConfig(configPaths.file, "config-global"))
  }

  async function openProjectConfig() {
    const loaded = await loadProjectConfig(root)
    const content = loaded.config ? `${JSON.stringify(loaded.config, null, 2)}\n` : `${JSON.stringify({ schemaVersion: 3 }, null, 2)}\n`
    await activity.run(t("activity.projectConfig"), () => documents.openConfig(initialProjectConfigPath, "config-project", async () => content))
  }

  function openSettings() { overlays.open("settings") }

  const settingsValues = () => [
    t(config().editor.wrap === "word" ? "settings.word" : "settings.none"),
    t(config().editor.lineNumbers ? "settings.show" : "settings.hide"),
    t(config().editor.syntax.enabled ? "settings.enabled" : "settings.disabled"),
    t(config().editor.formatting.formatOnSave ? "settings.enabled" : "settings.disabled"),
    config().keyboard.profile === "vim" ? "Vim" : t("settings.default"),
  ]

  async function toggleSetting() {
    const source = overlays.settingsScope()
    const base = source === "global" ? structuredClone(globalConfig()) : (() => { const { formatters: _formatters, ...project } = structuredClone(config()); return project })()
    const index = overlays.settingsIndex()
    if (index === 0) base.editor.wrap = base.editor.wrap === "none" ? "word" : "none"
    if (index === 1) base.editor.lineNumbers = !base.editor.lineNumbers
    if (index === 2) base.editor.syntax.enabled = !base.editor.syntax.enabled
    if (index === 3) base.editor.formatting.formatOnSave = !base.editor.formatting.formatOnSave
    if (index === 4) base.keyboard.profile = base.keyboard.profile === "default" ? "vim" : "default"
    try {
      if (source === "global") setGlobalConfig(await saveConfig(configPaths, serializeConfig(base as OecConfig)))
      else setProjectConfig(await saveProjectConfig(root, `${JSON.stringify(base, null, 2)}\n`))
      editor.setLineWrap(config().editor.wrap)
      setStatus(t("status.settingsUpdated"))
    } catch (error) { setStatus(error instanceof Error ? error.message : t("status.settingsFailed")) }
  }

  function openManual() { documents.openManual("MANUAL.md", oecManual(language())) }
  function openLogs() { documents.openLogs(); logs.markRead() }

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
      setStatus(t("status.editorActive"))
      return
    }
    if (!canShowBothSidePanels(renderer.width, config().layout)) setGitVisible(false)
    setExplorerVisible(true)
    setActive("explorer")
    setStatus(t("status.explorerActive"))
  }

  function focusEditor() {
    setActive("editor")
    setStatus(t("status.editorActive"))
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
      setStatus(t("status.gitActive"))
    }
  }

  function toggleExplorer() {
    const visible = !explorerVisible()
    if (visible && !canShowBothSidePanels(renderer.width, config().layout)) setGitVisible(false)
    setExplorerVisible(visible)
    if (visible) {
      setActive("explorer")
      setStatus(t("status.explorerVisible"))
    } else {
      setActive("editor")
      setStatus(t("status.explorerHidden"))
    }
  }

  function toggleGit() {
    const visible = !gitVisible()
    if (visible && !canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
    setGitVisible(visible)
    if (visible) {
      setActive("git")
      setStatus(t("status.gitVisible"))
    } else {
      setActive("editor")
      setStatus(t("status.gitHidden"))
    }
  }

  function cycleFocus() {
    if (active() === "explorer") return focusEditor()
    if (active() === "editor") return focusRight()
    return focusExplorer()
  }

  async function showGitHistory() {
    if (!canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
    setGitVisible(true)
    setActive("git")
    await git.showHistory()
  }

  async function showGitBranches() {
    if (!canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
    setGitVisible(true)
    setActive("git")
    await git.showBranches()
  }

  function activateExplorerAt(index: number) {
    setExplorerVisible(true)
    setActive("explorer")
    setStatus(t("status.explorerActive"))
    void explorer.activateAt(index)
  }

  async function activateGitAt(index: number) {
    if (!canShowBothSidePanels(renderer.width, config().layout)) setExplorerVisible(false)
    setGitVisible(true)
    setActive("git")
    git.select(index)
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
    closeOverlay: overlays.close, cancelProjectSearch, acceptConfirm, acceptDeletion, acceptRename, acceptGitRevert, acceptExternalChange, quit, refreshActivePanel, save: saveDocument, undo: editor.undo, redo: editor.redo, duplicateLine: editor.duplicateLine,
    openPalette: () => openOverlay("command-palette"), openLogs, openNewFile: () => openOverlay("new-file"), openProjectSearch: () => openOverlay("project-search"), openTextSearch: openContextSearch, editorFindOpen: editor.findOpen, moveEditorFindResult: editor.moveFindResult, acceptEditorFind: editor.acceptFind, closeEditorFind: editor.closeFind,
    focusLeft, focusRight, toggleExplorer, toggleGit, changeTab: () => documents.changeTab(1), cycleFocus, toggleWrap, togglePreview: documents.togglePreview, requestClose, copy: () => editor.copy((text) => renderer.copyToClipboardOSC52(text)), paste: editor.paste,
    paletteLength: () => search.paletteResults(commands()).length, acceptCommand, createNewFile, projectResultsLength: () => search.projectResults().length,
    openProjectResult, findInProject: search.findInProject, collapseAllFolders: explorer.collapseAllFolders, collapseSelectedFolder: explorer.collapseSelectedFolder,
    moveExplorerSelection, activateExplorerItem: explorer.activateItem, collapseExplorerItem, requestDeletion, requestRename, openProjectFolder: revealProjectFolder, moveGitSelection: git.moveSelection, activateGitItem: async () => { if (git.commitFocused()) return void commitGitChanges(); if (git.toggleSelectedFolder()) return; const diff = await git.openSelected(); if (diff) { documents.openDiff(diff); setActive("git") } }, collapseGitItem: () => { git.toggleSelectedFolder() }, collapseAllGitFolders: git.collapseAllFolders, stageGitItem, unstageGitItem, requestGitRevert, pullGitChanges, pushGitChanges, gitCommitFocused: git.commitFocused,
    openFileSearch: openContextSearch, fileSearchOpen: search.fileSearchOpen, closeFileSearch: search.closeFileSearch, moveFileSearchSelection: search.moveFileSelection, fileSearchResultsLength: () => search.fileResults().length, openFileSearchResult,
    openSearchExclusions, closeSearchExclusions, exclusionSuggestionsLength: () => search.exclusionSuggestions().length, exclusionIndex: search.exclusionIndex, setExclusionIndex: search.setExclusionIndex, completeExclusion: search.completeExclusion, toggleExclusion: search.toggleExclusion, removeExclusion: search.removeExclusion, bindings: () => config().keyboard.bindings, formatDocument: formatActiveDocument, handleVimKey: editor.handleVimKey, settingsIndex: overlays.settingsIndex, setSettingsIndex: overlays.setSettingsIndex, settingsScope: overlays.settingsScope, setSettingsScope: overlays.setSettingsScope, toggleSetting, openSettingsJson: () => { const scope = overlays.settingsScope(); overlays.close(); if (scope === "global") void openOecConfig(); else void openProjectConfig() },
    activeDiff: () => Boolean(documents.activeDiff()), openDiffFile: documents.openActiveDiffFile,
    gitHistoryActive: () => git.mode() !== "local", showGitHistory, showGitBranches, goBackGit: git.goBack,
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
    root, recovery, appVersion: APP_VERSION, rootName: () => basename(root) || root, active, explorerVisible, gitVisible, status, config, syntaxTheme, activity, logs, explorer, git, documents, editor, overlays, search, updates, toggleMassiveFiles,
    title: () => documents.filePath() ? displayPath(root, documents.filePath()!) : documents.activeDiff()?.file.path ? t("app.diffTitle", { path: documents.activeDiff()!.file.path }) : documents.activeLogs() ? t("app.logTitle") : t("app.noFile"), activateExplorerAt, activateGitAt, openFileSearchResult, requestCloseTab,
    paletteResults: () => search.paletteResults(commands()), settingsValues, setExplorerScroll: (value: ScrollBoxRenderable) => { explorerScroll = value }, setGitScroll: (value: ScrollBoxRenderable) => { gitScroll = value },
  }
}
