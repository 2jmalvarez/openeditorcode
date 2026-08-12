/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { readClipboard, selectedText } from "./editor/clipboard"
import { isControlPressed, isShiftPressed } from "./editor/keyboard"
import { highlightEditor, syntaxStyle } from "./editor/syntax"
import { createTextFile, readTextFile, writeTextFile } from "./filesystem/files"
import { countProjectLines, searchProjectText, type ProjectSearchResult } from "./filesystem/project"
import { createTree, displayPath, type TreeItem } from "./filesystem/tree"

type FocusTarget = "explorer" | "editor"
type Overlay = "command-palette" | "text-search" | "project-search" | "new-file" | "confirm" | undefined
type PendingAction = "open" | "close" | "quit"
type OpenTab = { path: string; content: string; savedContent: string }

function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
}

export function App(props: { root: string }) {
  const renderer = useRenderer()
  const [tree, setTree] = createSignal<TreeItem[]>([])
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set([props.root]))
  const [selected, setSelected] = createSignal(0)
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
  const [lineLabels, setLineLabels] = createSignal("1")
  const [editorScrollbar, setEditorScrollbar] = createSignal("")
  let editor: TextareaRenderable | undefined
  let explorerScroll: ScrollBoxRenderable | undefined
  let lineNumberScroll: ScrollBoxRenderable | undefined
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let lineLabelTimer: ReturnType<typeof setTimeout> | undefined
  let editorGeneration = 0
  let lastEditorScrollY = -1

  // A cleared editor can receive a delayed textarea change event. Without a path,
  // that buffer is not a document and must never trigger a save confirmation.
  const dirty = () => Boolean(filePath()) && content() !== savedContent()
  const selectedItem = () => tree()[selected()]
  const title = () => filePath() ? displayPath(props.root, filePath()!) : "Sin archivo abierto"
  const rootName = () => basename(props.root) || props.root
  const rootParent = () => dirname(props.root)

  const newFileDirectory = () => {
    const item = selectedItem()
    if (!item) return props.root
    return item.directory ? item.path : dirname(item.path)
  }

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
    scheduleHighlight(tab.path, tab.content, 0)
    refreshLineLabels()
    setCursor({ line: 1, column: 1 })
    setActive("editor")
    setStatus(`Abierto: ${displayPath(props.root, tab.path)}`)
  }

  function fileIcon(item: TreeItem): string {
    if (item.directory) return item.expanded ? "📂" : "📁"
    const extension = extname(item.name).toLocaleLowerCase()
    if ([".ts", ".tsx"].includes(extension)) return "🔷"
    if ([".js", ".jsx"].includes(extension)) return "🟨"
    if ([".json", ".yml", ".yaml", ".toml"].includes(extension)) return "⚙"
    if ([".css", ".scss", ".html"].includes(extension)) return "🎨"
    if ([".md", ".txt"].includes(extension)) return "📝"
    if ([".py", ".sh", ".ps1", ".bat"].includes(extension)) return "⚡"
    return "📄"
  }

  async function refreshTree() {
    try {
      const nextTree = await createTree(props.root, expanded())
      setTree(nextTree)
      setSelected((current) => Math.min(current, Math.max(0, nextTree.length - 1)))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo leer la carpeta.")
    }
  }

  async function collapseAllFolders() {
    setExpanded(new Set<string>())
    setSelected(0)
    await refreshTree()
    setStatus("Todas las carpetas fueron contraídas.")
  }

  async function collapseSelectedFolder() {
    const item = selectedItem()
    if (!item?.directory) {
      setStatus("Selecciona una carpeta para contraerla.")
      return
    }
    if (!expanded().has(item.path)) {
      setStatus("La carpeta seleccionada ya está contraída.")
      return
    }
    const next = new Set(expanded())
    for (const expandedPath of next) {
      const fromSelected = relative(item.path, expandedPath)
      if (fromSelected === "" || !fromSelected.startsWith("..")) next.delete(expandedPath)
    }
    setExpanded(next)
    await refreshTree()
    setStatus(`Carpeta contraída: ${item.name}`)
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
    await openFile(item.path)
  }

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
    const path = join(newFileDirectory(), name)
    try {
      await createTextFile(props.root, path)
      await refreshTree()
      closeOverlay()
      await openFile(path)
      setStatus(`Creado: ${displayPath(props.root, path)}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo crear el archivo.")
    }
  }

  function closeFile() {
    editorGeneration += 1
    if (highlightTimer) clearTimeout(highlightTimer)
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
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
      setLineLabels("1")
      setEditorScrollbar("")
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
    scheduleLineMetrics()
    setStatus(mode === "word" ? "Ajuste de línea activado." : "Ajuste de línea desactivado.")
  }

  function refreshLineLabels() {
    if (!editor) {
      setLineLabels("1")
      return
    }
    const sources = editor.lineInfo.lineSources
    if (!sources.length) {
      setLineLabels(content().split("\n").map((_, index) => String(index + 1)).join("\n"))
      return
    }
    const wraps = editor.lineInfo.lineWraps
    setLineLabels(sources.map((source, index) => {
      if (wraps[index] !== 0) return ""
      return String(source + 1)
    }).join("\n"))
    lineNumberScroll?.scrollTo({ x: 0, y: editor.scrollY })
    lastEditorScrollY = editor.scrollY
    const visibleRows = Math.max(1, editor.height)
    const totalRows = Math.max(visibleRows, editor.virtualLineCount)
    const available = Math.max(1, totalRows - visibleRows)
    const markerRow = Math.min(visibleRows - 1, Math.round((editor.scrollY / available) * (visibleRows - 1)))
    setEditorScrollbar(Array.from({ length: visibleRows }, (_, index) => index === markerRow ? "█" : "│").join("\n"))
  }

  function scheduleLineMetrics() {
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
    const generation = editorGeneration
    lineLabelTimer = setTimeout(() => {
      if (generation === editorGeneration && editor) refreshLineLabels()
    }, 16)
  }

  function scheduleHighlight(path: string | undefined, text: string, delay = 120) {
    if (highlightTimer) clearTimeout(highlightTimer)
    const generation = editorGeneration
    highlightTimer = setTimeout(() => {
      if (generation === editorGeneration && filePath() === path && editor && editor.plainText === text) highlightEditor(editor, path, text)
    }, delay)
  }

  function undo() {
    if (editor?.undo()) {
      setContent(editor.plainText)
      scheduleHighlight(filePath(), editor.plainText)
      setStatus("Cambio deshecho.")
    }
  }

  function redo() {
    if (editor?.redo()) {
      setContent(editor.plainText)
      scheduleHighlight(filePath(), editor.plainText)
      setStatus("Cambio rehecho.")
    }
  }

  const commands = () => [
    { title: "Abrir explorador", shortcut: "Ctrl+B", run: () => { setExplorerVisible(true); setActive("explorer"); setStatus("Explorador activo.") } },
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
        return void collapseAllFolders()
      }
      if (shift && isEnter) {
        key.preventDefault()
        key.stopPropagation()
        return void collapseSelectedFolder()
      }
      if (key.name === "down") setSelected((value) => Math.min(value + 1, Math.max(0, tree().length - 1)))
      if (key.name === "up") setSelected((value) => Math.max(0, value - 1))
      if (isEnter) void activateItem()
      if (key.name === "left") {
        const item = selectedItem()
        if (item?.directory && item.expanded) void activateItem(item)
      }
    }
  })

  createEffect(() => {
    if (overlay() || active() !== "editor") editor?.blur()
    else editor?.focus()
  })

  createEffect(() => {
    const itemIndex = selected()
    explorerScroll?.scrollTo({ x: explorerScroll.scrollLeft, y: Math.max(0, itemIndex - 4) })
  })

  onMount(() => {
    void refreshTree()
    const syncEditorScroll = () => {
      if (editor && editor.scrollY !== lastEditorScrollY) refreshLineLabels()
    }
    renderer.on("frame", syncEditorScroll)
    onCleanup(() => renderer.off("frame", syncEditorScroll))
  })

  onCleanup(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
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
        <box style={{ width: 32, flexShrink: 0, flexDirection: "column", border: ["right"], borderColor: "#30404d" }}>
          <box style={{ paddingX: 1, paddingY: 1 }}>
            <text fg={active() === "explorer" ? "#70d6a7" : "#8ca0ae"}>ARCHIVOS</text>
          </box>
          <scrollbox ref={(value) => { explorerScroll = value }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1 }}>
            <For each={tree()}>{(item, itemIndex) => (
              <box id={`tree-${itemIndex()}`} style={{ paddingLeft: item.depth + 1, flexDirection: "row", alignItems: "center", backgroundColor: itemIndex() === selected() ? "#28404a" : undefined }}>
                <text fg={item.directory ? "#8ed1ff" : item.path === filePath() ? "#f2c66d" : "#d6e5dc"}>{fileIcon(item)} {item.name}</text>
                <Show when={!item.directory && lineCounts()[item.path] !== undefined} fallback={<box />}>
                  <text style={{ marginLeft: "auto" }} fg="#71808b">{lineCounts()[item.path]}</text>
                </Show>
              </box>
            )}</For>
          </scrollbox>
        </box>
        </Show>
        <box style={{ flexGrow: 1, minWidth: 0, flexDirection: "column" }}>
          <scrollbox style={{ height: 2, flexShrink: 0, backgroundColor: "#111820" }}>
            <box style={{ flexDirection: "row" }}>
              <For each={tabs()}>{(tab, index) => (
                <box style={{ paddingX: 1, flexShrink: 0, backgroundColor: index() === activeTab() ? "#263a46" : "#111820" }}>
                  <text fg={index() === activeTab() ? "#f2c66d" : "#8ca0ae"}>{index() === activeTab() && dirty() ? "* " : ""}{basename(tab.path)}</text>
                </box>
              )}</For>
            </box>
          </scrollbox>
          <box style={{ height: 2, paddingX: 1, backgroundColor: "#151c23" }}>
            <text fg="#f2c66d">{title()}</text>
          </box>
          <Show
            when={filePath()}
            fallback={<box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}><text fg="#71808b">Pulsa Ctrl+B y Enter para abrir un archivo</text></box>}
          >
            <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
              <scrollbox ref={(value) => { lineNumberScroll = value; value.verticalScrollBar.visible = false }} style={{ width: 5, flexShrink: 0, paddingRight: 1, backgroundColor: "#151c23" }}>
                <text fg="#60717f">{lineLabels()}</text>
              </scrollbox>
              <textarea
                ref={(value) => { editor = value; scheduleLineMetrics(); scheduleHighlight(filePath(), content(), 0) }}
                initialValue={content()}
                focused={active() === "editor"}
                wrapMode={wrapMode()}
                syntaxStyle={syntaxStyle}
                keyBindings={[
                  ...defaultTextareaKeyBindings,
                  { name: "z", ctrl: true, action: "undo" },
                  { name: "z", ctrl: true, shift: true, action: "redo" },
                ]}
                style={{ flexGrow: 1, minWidth: 0, backgroundColor: "#101419", textColor: "#d6e5dc", cursorColor: "#70d6a7" }}
                onContentChange={() => {
                  const text = editor?.plainText ?? ""
                  setContent(text)
                  scheduleHighlight(filePath(), text)
                  scheduleLineMetrics()
                }}
                onCursorChange={(value) => { setCursor({ line: value.line + 1, column: value.visualColumn + 1 }); scheduleLineMetrics() }}
              />
              <box style={{ width: 1, flexShrink: 0, backgroundColor: "#151c23" }}>
                <text fg="#60717f">{editorScrollbar()}</text>
              </box>
            </box>
          </Show>
        </box>
      </box>
      <box style={{ height: 3, paddingX: 1, flexDirection: "column", backgroundColor: "#17202a" }}>
        <text fg="#8ca0ae">{status()}</text>
        <text fg="#8ca0ae">Ln {cursor().line}:{cursor().column} | P menú | B archivos | F buscar | Alt+F global | Shift+Tab pestañas</text>
      </box>
      <Show when={overlay() === "command-palette" || overlay() === "text-search" || overlay() === "project-search" || overlay() === "new-file"} fallback={<box />}>
        <box style={{ position: "absolute", top: "20%", left: "15%", width: "70%", height: "55%", padding: 1, flexDirection: "column", backgroundColor: "#1b252e", border: true, borderColor: "#70d6a7" }}>
          <text fg="#70d6a7">{overlay() === "command-palette" ? "COMANDOS Y CONFIGURACIÓN" : overlay() === "project-search" ? "BUSCAR EN TODO EL PROYECTO" : overlay() === "new-file" ? "NUEVO ARCHIVO" : "BUSCAR EN EL ARCHIVO"}</text>
          <Show when={overlay() !== "new-file"} fallback={<box><text style={{ marginTop: 1 }} fg="#8ca0ae">Carpeta: {displayPath(props.root, newFileDirectory())}</text><input focused value={newFileName()} onInput={setNewFileName} placeholder="nombre.ext" style={{ marginTop: 1, backgroundColor: "#101419" }} /></box>}>
            <input focused value={query()} onInput={(value) => { setQuery(value); setSearchIndex(0); if (overlay() === "project-search") setProjectResults([]) }} placeholder="Escribe para buscar..." style={{ marginTop: 1, backgroundColor: "#101419" }} />
          </Show>
          <Show when={overlay() === "command-palette"} fallback={<box />}>
            <scrollbox scrollY style={{ flexGrow: 1, marginTop: 1 }}>
              <For each={paletteResults()}>{(command, itemIndex) => <box style={{ flexDirection: "row", backgroundColor: itemIndex() === searchIndex() ? "#28404a" : undefined }}><text fg="#d6e5dc">{command.title}</text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{command.shortcut}</text></box>}</For>
            </scrollbox>
          </Show>
          <Show when={overlay() === "project-search"} fallback={<box />}>
            <scrollbox style={{ flexGrow: 1, marginTop: 1 }}>
              <Show when={!projectSearching()} fallback={<box><text fg="#8ca0ae">Buscando...</text></box>}>
                <For each={projectResults()}>{(result, index) => <box style={{ backgroundColor: index() === searchIndex() ? "#28404a" : undefined }}><text fg="#f2c66d">{displayPath(props.root, result.path)}:{result.line}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box>}</For>
              </Show>
            </scrollbox>
          </Show>
          <text fg="#8ca0ae">{overlay() === "command-palette" ? "Flechas seleccionar | Enter ejecutar | Esc cerrar" : overlay() === "project-search" ? "Enter buscar | Flechas resultado | Enter abrir | Esc cerrar" : overlay() === "new-file" ? "Enter crear | Esc cancelar" : "Enter buscar siguiente | Esc cerrar"}</text>
        </box>
      </Show>
      <Show when={overlay() === "confirm"} fallback={<box />}>
        <box style={{ position: "absolute", top: "28%", left: "25%", width: "50%", height: 13, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
          <text fg="#f2c66d">Hay cambios sin guardar.</text>
          <text style={{ marginTop: 1 }} fg="#b8c7d1">Elige qué hacer con el archivo actual.</text>
          <box style={{ marginTop: 1, flexDirection: "column" }}>
            <For each={["Guardar", "Guardar y cerrar", "Cerrar sin guardar"]}>{(label, index) => <box style={{ paddingX: 1, backgroundColor: index() === confirmChoice() ? "#6b5224" : undefined }}><text fg={index() === confirmChoice() ? "#ffffff" : "#d6e5dc"}>{index() === confirmChoice() ? "› " : "  "}{label}</text></box>}</For>
          </box>
          <text fg="#8ca0ae">Flechas arriba/abajo | Enter confirmar | Esc cancelar</text>
        </box>
      </Show>
    </box>
  )
}

export function resolveRoot(argument?: string): string {
  return resolve(argument || process.cwd())
}
