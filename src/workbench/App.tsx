/** @jsxImportSource @opentui/solid */
import { type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { basename, dirname, join } from "node:path"
import { readClipboard, selectedText } from "../editor/clipboard"
import { EditorPane } from "../editor/EditorPane"
import { isControlPressed, isShiftPressed } from "../editor/keyboard"
import { useEditorMetrics } from "../editor/useEditorMetrics"
import { DocumentTabs, type OpenTab } from "../documents/DocumentTabs"
import { createTextFile, readTextFile, writeTextFile } from "../documents/files"
import { Overlays, type Command } from "../dialogs/Overlays"
import { ExplorerPane } from "../explorer/ExplorerPane"
import { displayPath } from "../explorer/tree"
import { useExplorer } from "../explorer/useExplorer"
import { countProjectLines, searchProjectText, type ProjectSearchResult } from "../search/project-search"

import type { FocusTarget, Overlay, PendingAction } from "./types"

function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
}

export function App(props: { root: string }) {
  const renderer = useRenderer()
  const [active, setActive] = createSignal<FocusTarget>("explorer")
  const [explorerVisible, setExplorerVisible] = createSignal(true)
  const [filePath, setFilePath] = createSignal<string>()
  const [tabs, setTabs] = createSignal<OpenTab[]>([])
  const [activeTab, setActiveTab] = createSignal(-1)
  const [pendingFile, setPendingFile] = createSignal<string>()
  const [pendingAction, setPendingAction] = createSignal<PendingAction>()
  const [confirmChoice, setConfirmChoice] = createSignal(1)
  const [savedContent, setSavedContent] = createSignal("")
  const [content, setContent] = createSignal("")
  const [status, setStatus] = createSignal("Explorador listo")
  const [overlay, setOverlay] = createSignal<Overlay>()
  const [query, setQuery] = createSignal("")
  const [newFileName, setNewFileName] = createSignal("")
  const [searchIndex, setSearchIndex] = createSignal(0)
  const [projectResults, setProjectResults] = createSignal<ProjectSearchResult[]>([])
  const [projectSearching, setProjectSearching] = createSignal(false)
  const [lineCounts, setLineCounts] = createSignal<Record<string, number>>({})
  const [wrapMode, setWrapMode] = createSignal<"none" | "word">("none")
  const [cursor, setCursor] = createSignal({ line: 1, column: 1 })
  let editor: TextareaRenderable | undefined
  let explorerScroll: ScrollBoxRenderable | undefined

  // A cleared editor can receive a delayed textarea change event. Without a path,
  // that buffer is not a document and must never trigger a save confirmation.
  const dirty = () => Boolean(filePath()) && content() !== savedContent()
  const title = () => filePath() ? displayPath(props.root, filePath()!) : "Sin archivo abierto"
  const rootName = () => basename(props.root) || props.root
  const rootParent = () => dirname(props.root)

  const metrics = useEditorMetrics({ editor: () => editor, filePath, content })

  function syncActiveTab() {
    const tabIndex = activeTab()
    if (tabIndex < 0) return
    const currentContent = editor?.plainText ?? content()
    setTabs((currentTabs) => currentTabs.map((tab, index) => index === tabIndex ? { ...tab, content: currentContent, savedContent: savedContent() } : tab))
  }

  function loadTab(index: number, nextTabs = tabs()) {
    const tab = nextTabs[index]
    if (!tab) return
    setActiveTab(index)
    setFilePath(tab.path)
    setContent(tab.content)
    setSavedContent(tab.savedContent)
    editor?.setText(tab.content)
    metrics.scheduleHighlight(tab.path, tab.content, 0)
    metrics.refresh()
    setCursor({ line: 1, column: 1 })
    setActive("editor")
    setStatus(`Abierto: ${displayPath(props.root, tab.path)}`)
  }

  async function openFile(path: string) {
    try {
      syncActiveTab()
      const existingIndex = tabs().findIndex((tab) => tab.path === path)
      if (existingIndex >= 0) {
        loadTab(existingIndex)
        return
      }
      const nextContent = await readTextFile(props.root, path)
      const nextTabs = [...tabs(), { path, content: nextContent, savedContent: nextContent }]
      setTabs(nextTabs)
      loadTab(nextTabs.length - 1, nextTabs)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo abrir el archivo.")
    }
  }

  const explorer = useExplorer({ root: props.root, setStatus, openFile })

  async function save(): Promise<boolean> {
    const path = filePath()
    if (!path) {
      setStatus("Selecciona un archivo antes de guardar.")
      return false
    }
    try {
      const text = editor?.plainText ?? content()
      await writeTextFile(props.root, path, text)
      setContent(text)
      setSavedContent(text)
      const tabIndex = activeTab()
      setTabs((currentTabs) => currentTabs.map((tab, index) => index === tabIndex ? { ...tab, content: text, savedContent: text } : tab))
      setStatus(`Guardado: ${basename(path)}`)
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el archivo.")
      return false
    }
  }

  function closeOverlay() {
    setOverlay(undefined)
    setQuery("")
    setNewFileName("")
    setSearchIndex(0)
    setProjectResults([])
    setPendingFile(undefined)
    setPendingAction(undefined)
    setConfirmChoice(1)
  }

  function findText() {
    const needle = query()
    if (!needle || !editor) return
    const start = editor.cursorOffset + 1
    const text = editor.plainText
    const at = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase(), start)
    const wrapped = at === -1 ? text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase()) : at
    if (wrapped === -1) {
      setStatus(`No se encontró “${needle}”.`)
      return
    }
    editor.setSelection(wrapped, wrapped + needle.length)
    editor.cursorOffset = wrapped
    setStatus(`Coincidencia encontrada: ${needle}`)
    closeOverlay()
  }

  async function findInProject() {
    if (!query().trim()) return
    setProjectSearching(true)
    try {
      const results = await searchProjectText(props.root, query())
      setProjectResults(results)
      setSearchIndex(0)
      setStatus(results.length ? `${results.length} coincidencias en el proyecto.` : "No se encontraron coincidencias en el proyecto.")
    } catch {
      setStatus("No se pudo buscar en el proyecto.")
    } finally {
      setProjectSearching(false)
    }
  }

  async function showProjectLineCount() {
    setStatus("Calculando líneas del proyecto...")
    try {
      const summary = await countProjectLines(props.root)
      setLineCounts(summary.byPath)
      setStatus(`Proyecto: ${summary.lines.toLocaleString()} líneas en ${summary.files.toLocaleString()} archivos de texto.`)
    } catch {
      setStatus("No se pudieron calcular las líneas del proyecto.")
    }
  }

  async function createNewFile() {
    const name = newFileName().trim()
    if (!name) {
      setStatus("Escribe un nombre de archivo.")
      return
    }
    if (name.includes("/") || name.includes("\\")) {
      setStatus("El nombre debe pertenecer a la carpeta seleccionada.")
      return
    }
    const path = join(explorer.newFileDirectory(), name)
    try {
      await createTextFile(props.root, path)
      await explorer.refreshTree()
      closeOverlay()
      await openFile(path)
      setStatus(`Creado: ${displayPath(props.root, path)}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear el archivo.")
    }
  }

  function closeFile() {
    metrics.reset()
    const closingIndex = activeTab()
    const nextTabs = tabs().filter((_, index) => index !== closingIndex)
    setTabs(nextTabs)
    if (!nextTabs.length) {
      setActiveTab(-1)
      setFilePath(undefined)
      setContent("")
      setSavedContent("")
      editor?.setText("")
      editor = undefined
      setExplorerVisible(true)
      setActive("explorer")
      setStatus("Archivo cerrado.")
      return
    }
    loadTab(Math.min(closingIndex, nextTabs.length - 1), nextTabs)
  }

  function requestCloseFile() {
    if (!filePath()) return
    if (dirty()) {
      setPendingAction("close")
      setConfirmChoice(1)
      setOverlay("confirm")
      setStatus("Hay cambios sin guardar.")
      return
    }
    closeFile()
  }

  function finishPendingAction() {
    const action = pendingAction()
    const nextFile = pendingFile()
    closeOverlay()
    if (action === "open" && nextFile) void openFile(nextFile)
    if (action === "close") closeFile()
    if (action === "quit") renderer.destroy()
  }

  function quit() {
    if (dirty()) {
      setPendingAction("quit")
      setConfirmChoice(1)
      setOverlay("confirm")
      setStatus("Hay cambios sin guardar.")
      return
    }
    renderer.destroy()
  }

  async function acceptConfirm() {
    const choice = confirmChoice()
    if (choice === 0) {
      if (await save()) closeOverlay()
      return
    }
    if (choice === 1) {
      if (await save()) finishPendingAction()
      return
    }
    const action = pendingAction()
    const nextFile = pendingFile()
    closeOverlay()
    setStatus("Cambios descartados.")
    if (action === "open" && nextFile) void openFile(nextFile)
    if (action === "close") closeFile()
    if (action === "quit") renderer.destroy()
  }

  function changeTab(direction: number) {
    if (tabs().length < 2) return
    syncActiveTab()
    const nextIndex = (activeTab() + direction + tabs().length) % tabs().length
    loadTab(nextIndex)
  }

  function copy() {
    const text = selectedText(editor)
    if (!text) {
      setStatus("Selecciona texto antes de copiar.")
      return
    }
    if (renderer.copyToClipboardOSC52(text)) setStatus("Copiado al portapapeles.")
    else setStatus("El terminal no admite la copia al portapapeles.")
  }

  async function paste() {
    if (active() !== "editor" || !editor) return
    try {
      const text = await readClipboard()
      if (!text) {
        setStatus("El portapapeles está vacío.")
        return
      }
      editor.insertText(text)
      setContent(editor.plainText)
      setStatus("Pegado desde el portapapeles.")
    } catch {
      setStatus("No se pudo leer el portapapeles.")
    }
  }

  function setLineWrap(mode: "none" | "word") {
    setWrapMode(mode)
    if (editor) editor.wrapMode = mode
    metrics.schedule()
    setStatus(mode === "word" ? "Ajuste de línea activado." : "Ajuste de línea desactivado.")
  }

  function undo() {
    if (editor?.undo()) {
      setContent(editor.plainText)
      metrics.scheduleHighlight(filePath(), editor.plainText)
      setStatus("Cambio deshecho.")
    }
  }

  function redo() {
    if (editor?.redo()) {
      setContent(editor.plainText)
      metrics.scheduleHighlight(filePath(), editor.plainText)
      setStatus("Cambio rehecho.")
    }
  }

  const commands = (): Command[] => [
    { title: "Abrir explorador", shortcut: "Ctrl+B", run: () => { setExplorerVisible(true); setActive("explorer"); setStatus("Explorador activo.") } },
    { title: "Actualizar explorador", shortcut: "F5", run: () => void explorer.refreshExplorer() },
    { title: "Crear archivo en carpeta seleccionada", shortcut: "Ctrl+N", run: () => { setOverlay("new-file"); setNewFileName("") } },
    { title: "Buscar texto", shortcut: "Ctrl+F", run: () => { setOverlay("text-search"); setQuery("") } },
    { title: "Buscar en todo el proyecto", shortcut: "Ctrl+Alt+F", run: () => { setOverlay("project-search"); setQuery(""); setProjectResults([]) } },
    { title: "Guardar archivo", shortcut: "Ctrl+S", run: () => void save() },
    { title: "Cerrar archivo", shortcut: "Ctrl+W", run: requestCloseFile },
    { title: "Pestaña siguiente", shortcut: "Shift+Tab", run: () => changeTab(1) },
    { title: "Copiar selección", shortcut: "Ctrl+C", run: copy },
    { title: "Pegar portapapeles", shortcut: "Ctrl+V", run: () => void paste() },
    { title: "Alternar línea completa", shortcut: "Ctrl+L", run: () => setLineWrap(wrapMode() === "none" ? "word" : "none") },
    { title: "Deshacer último cambio", shortcut: "Ctrl+Z", run: undo },
    { title: "Rehacer último cambio", shortcut: "Ctrl+Shift+Z", run: redo },
    { title: "Calcular líneas del proyecto", shortcut: "Paleta", run: () => void showProjectLineCount() },
    { title: `Configuración: ajuste de línea ${wrapMode() === "word" ? "activado" : "desactivado"}`, shortcut: "Ctrl+Alt+W", run: () => setLineWrap(wrapMode() === "none" ? "word" : "none") },
  ]
  const paletteResults = () => {
    const needle = normalizeForSearch(query())
    return commands().filter((command) => normalizeForSearch(command.title).includes(needle) || normalizeForSearch(command.shortcut).includes(needle))
  }

  function acceptCommand() {
    const command = paletteResults()[searchIndex()]
    if (!command) return
    closeOverlay()
    command.run()
  }

  useKeyboard((key) => {
    const keyName = key.name.toLocaleLowerCase()
    const isEnter = keyName === "return" || keyName === "enter"
    const shift = key.shift || isShiftPressed()
    const ctrl = key.ctrl || isControlPressed()
    if (overlay() === "confirm") {
      if (key.name === "up") setConfirmChoice((choice) => Math.max(0, choice - 1))
      if (key.name === "down") setConfirmChoice((choice) => Math.min(2, choice + 1))
      if (key.name === "return") void acceptConfirm()
      if (key.name === "escape") closeOverlay()
      return
    }
    if (ctrl && keyName === "q") return quit()
    if (keyName === "f5") return void explorer.refreshExplorer()
    if (ctrl && keyName === "s") return void save()
    if (ctrl && shift && keyName === "z") {
      key.preventDefault()
      key.stopPropagation()
      return redo()
    }
    if (ctrl && keyName === "z") {
      key.preventDefault()
      key.stopPropagation()
      return undo()
    }
    if (ctrl && keyName === "p") {
      setOverlay("command-palette")
      setQuery("")
      setSearchIndex(0)
      return
    }
    if (ctrl && keyName === "n") {
      setOverlay("new-file")
      setNewFileName("")
      return
    }
    if (ctrl && (key.option || key.meta) && keyName === "f") {
      setOverlay("project-search")
      setQuery("")
      setProjectResults([])
      return
    }
    if (ctrl && keyName === "f") {
      setOverlay("text-search")
      setQuery("")
      return
    }
    if (ctrl && keyName === "b") {
      if (active() === "explorer" && filePath()) {
        setActive("editor")
        setStatus("Editor activo.")
        return
      }
      setExplorerVisible(true)
      setActive("explorer")
      setStatus("Explorador activo. Flechas para seleccionar, Enter para abrir, Shift+Enter para contraer.")
      return
    }
    if (shift && keyName === "tab") return changeTab(1)
    if (ctrl && (key.option || key.meta) && keyName === "w") {
      setLineWrap(wrapMode() === "none" ? "word" : "none")
      return
    }
    if (ctrl && keyName === "l") {
      setLineWrap(wrapMode() === "none" ? "word" : "none")
      return
    }
    if (ctrl && keyName === "w") return requestCloseFile()
    if (ctrl && keyName === "c") return copy()
    if (ctrl && keyName === "v") return void paste()
    if (key.name === "escape" && overlay()) return closeOverlay()
    if (overlay() === "command-palette") {
      if (key.name === "down") setSearchIndex((value) => Math.min(value + 1, Math.max(0, paletteResults().length - 1)))
      if (key.name === "up") setSearchIndex((value) => Math.max(0, value - 1))
      if (key.name === "return") acceptCommand()
      return
    }
    if (overlay() === "text-search" && key.name === "return") return findText()
    if (overlay() === "new-file" && key.name === "return") return void createNewFile()
    if (overlay() === "project-search") {
      if (key.name === "down") setSearchIndex((value) => Math.min(value + 1, Math.max(0, projectResults().length - 1)))
      if (key.name === "up") setSearchIndex((value) => Math.max(0, value - 1))
      if (key.name === "return") {
        const result = projectResults()[searchIndex()]
        if (!result) return void findInProject()
        closeOverlay()
        return void openFile(result.path).then(() => editor?.gotoLine(result.line - 1))
      }
      return
    }
    if (key.name === "tab") {
      setActive((value) => value === "explorer" ? "editor" : "explorer")
      return
    }
    if (active() === "explorer") {
      if (ctrl && shift && isEnter) {
        key.preventDefault()
        key.stopPropagation()
        return void explorer.collapseAllFolders()
      }
      if (shift && isEnter) {
        key.preventDefault()
        key.stopPropagation()
        return void explorer.collapseSelectedFolder()
      }
      if (key.name === "down") explorer.setSelected((value) => Math.min(value + 1, Math.max(0, explorer.tree().length - 1)))
      if (key.name === "up") explorer.setSelected((value) => Math.max(0, value - 1))
      if (isEnter) void explorer.activateItem()
      if (key.name === "left") {
        const item = explorer.selectedItem()
        if (item?.directory && item.expanded) void explorer.activateItem(item)
      }
    }
  })

  createEffect(() => {
    if (overlay() || active() !== "editor") editor?.blur()
    else editor?.focus()
  })

  createEffect(() => {
    const itemIndex = explorer.selected()
    explorerScroll?.scrollTo({ x: explorerScroll.scrollLeft, y: Math.max(0, itemIndex - 4) })
  })

  onMount(() => {
    renderer.on("frame", metrics.syncScroll)
    onCleanup(() => renderer.off("frame", metrics.syncScroll))
  })

  return (
    <box style={{ flexDirection: "column", height: "100%", backgroundColor: "#101419" }}>
      <box style={{ height: 2, paddingX: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#17202a" }}>
        <box style={{ flexDirection: "column" }}>
          <text fg="#70d6a7"><strong>{rootName()}</strong></text>
          <text fg="#71808b">{rootParent()}</text>
        </box>
        <text style={{ marginLeft: "auto" }} fg="#d6e5dc"><strong>OEC</strong></text>
      </box>
      <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
        <Show when={explorerVisible()} fallback={<box />}>
          <ExplorerPane root={props.root} active={() => active() === "explorer"} tree={explorer.tree} selected={explorer.selected} filePath={filePath} lineCounts={lineCounts} setScroll={(value) => { explorerScroll = value }} />
        </Show>
        <box style={{ flexGrow: 1, minWidth: 0, flexDirection: "column" }}>
          <DocumentTabs tabs={tabs} activeTab={activeTab} dirty={dirty} />
          <box style={{ height: 2, paddingX: 1, backgroundColor: "#151c23" }}>
            <text fg="#f2c66d">{title()}</text>
          </box>
          <EditorPane filePath={filePath} content={content} active={active} wrapMode={wrapMode} lineLabels={metrics.lineLabels} scrollbar={metrics.scrollbar} setEditor={(value) => { editor = value; metrics.schedule(); metrics.scheduleHighlight(filePath(), content(), 0) }} setLineNumberScroll={metrics.setLineNumberScroll} onContentChange={() => { const text = editor?.plainText ?? ""; setContent(text); metrics.scheduleHighlight(filePath(), text); metrics.schedule() }} onCursorChange={(line, visualColumn) => { setCursor({ line: line + 1, column: visualColumn + 1 }); metrics.schedule() }} />
        </box>
      </box>
      <box style={{ height: 3, paddingX: 1, flexDirection: "column", backgroundColor: "#17202a" }}>
        <text fg="#8ca0ae">{status()}</text>
        <text fg="#8ca0ae">Ln {cursor().line}:{cursor().column} | P menú | B archivos | F buscar | Alt+F global | Shift+Tab pestañas</text>
      </box>
      <Overlays root={props.root} overlay={overlay} query={query} setQuery={(value) => { setQuery(value); setSearchIndex(0); if (overlay() === "project-search") setProjectResults([]) }} newFileName={newFileName} setNewFileName={setNewFileName} newFileDirectory={explorer.newFileDirectory} searchIndex={searchIndex} paletteResults={paletteResults} projectResults={projectResults} projectSearching={projectSearching} confirmChoice={confirmChoice} />
    </box>
  )
}
