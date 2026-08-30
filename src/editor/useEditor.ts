import type { KeyEvent, TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal } from "solid-js"
import { readClipboard, selectedText } from "./clipboard"
import { findMatches, type FindResult } from "./find"
import { useEditorMetrics } from "./useEditorMetrics"
import type { FocusTarget } from "../workbench/types"
import type { SyntaxTheme } from "./syntax"

type Props = {
  active: () => FocusTarget
  overlay: () => unknown
  filePath: () => string | undefined
  setStatus: (status: string) => void
  wrapMode?: "none" | "word"
  syntaxTheme: () => SyntaxTheme
  vimEnabled: () => boolean
}

export function useEditor(props: Props) {
  const [content, setContent] = createSignal("")
  const [wrapMode, setWrapMode] = createSignal<"none" | "word">(props.wrapMode ?? "none")
  const [cursor, setCursor] = createSignal({ line: 1, column: 1 })
  const [findOpen, setFindOpen] = createSignal(false)
  const [findQuery, setFindQuery] = createSignal("")
  const [findResults, setFindResults] = createSignal<FindResult[]>([])
  const [findIndex, setFindIndex] = createSignal(0)
  const [vimMode, setVimMode] = createSignal<"normal" | "insert" | "visual">("insert")
  let vimPending = ""
  let renderable: TextareaRenderable | undefined
  let replacingText = false
  const metrics = useEditorMetrics({ editor: () => renderable, filePath: props.filePath, content, syntaxTheme: props.syntaxTheme })

  function setEditor(value: TextareaRenderable) {
    renderable = value
    metrics.schedule()
    metrics.scheduleHighlight(props.filePath(), content(), 0)
  }

  function detachEditor() {
    if (!renderable) return
    renderable = undefined
    metrics.reset()
  }

  function setText(text: string) {
    resetFind()
    setContent(text)
    if (renderable) {
      renderable.blur()
      replacingText = true
      renderable.setText(text)
      replacingText = false
    }
    metrics.scheduleHighlight(props.filePath(), text, 0)
    metrics.refresh()
  }

  function clear() {
    metrics.reset()
    resetFind()
    setContent("")
    if (renderable) {
      renderable.blur()
      replacingText = true
      renderable.setText("")
      replacingText = false
    }
    renderable = undefined
  }

  function onContentChange() {
    if (replacingText) return
    const text = renderable?.plainText ?? ""
    setContent(text)
    metrics.scheduleHighlight(props.filePath(), text)
    metrics.schedule()
  }

  function updateCursor() {
    const position = renderable?.logicalCursor
    if (position) setCursor({ line: position.row + 1, column: position.col + 1 })
  }

  function onCursorChange() {
    updateCursor()
  }

  function setLineWrap(mode: "none" | "word") {
    setWrapMode(mode)
    if (renderable) {
      renderable.wrapMode = mode
      // Wait for the textarea to rebuild visual rows before replacing its highlights.
      metrics.scheduleHighlight(props.filePath(), renderable.plainText, 16)
    }
    metrics.schedule()
    props.setStatus(mode === "word" ? "Ajuste de línea activado." : "Ajuste de línea desactivado.")
  }

  function undo() {
    if (renderable?.undo()) {
      setContent(renderable.plainText)
      metrics.scheduleHighlight(props.filePath(), renderable.plainText)
      props.setStatus("Cambio deshecho.")
    }
  }

  function redo() {
    if (renderable?.redo()) {
      setContent(renderable.plainText)
      metrics.scheduleHighlight(props.filePath(), renderable.plainText)
      props.setStatus("Cambio rehecho.")
    }
  }

  function replaceCurrentText(text: string): boolean {
    if (!renderable || text === renderable.plainText) return false
    renderable.replaceText(text)
    setContent(renderable.plainText)
    metrics.scheduleHighlight(props.filePath(), renderable.plainText, 0)
    metrics.schedule()
    return true
  }

  function syncVimMutation() {
    if (!renderable) return
    setContent(renderable.plainText)
    metrics.scheduleHighlight(props.filePath(), renderable.plainText)
    metrics.schedule()
  }

  function handleVimKey(key: KeyEvent): boolean {
    if (!props.vimEnabled() || props.active() !== "editor" || !props.filePath() || !renderable) return false
    const editor = renderable
    const name = key.name.toLowerCase() === "return" ? "enter" : key.name.toLowerCase()
    if (vimMode() === "insert") {
      if (name !== "escape" && name !== "esc") return false
      setVimMode("normal"); vimPending = ""; renderable.clearSelection(); return true
    }
    if (name === "escape" || name === "esc") { setVimMode("normal"); vimPending = ""; renderable.clearSelection(); return true }
    const select = vimMode() === "visual"
    const move = (action: () => boolean) => { action(); updateCursor(); metrics.schedule(); return true }
    if (name === "h") return move(() => editor.moveCursorLeft({ select }))
    if (name === "l") return move(() => editor.moveCursorRight({ select }))
    if (name === "j") return move(() => editor.moveCursorDown({ select }))
    if (name === "k") return move(() => editor.moveCursorUp({ select }))
    if (name === "w") return move(() => editor.moveWordForward({ select }))
    if (name === "b") return move(() => editor.moveWordBackward({ select }))
    if (name === "0") { renderable.gotoLineStart(); updateCursor(); return true }
    if (name === "$") { renderable.gotoLineEnd({ select }); updateCursor(); return true }
    if (name === "v" && vimMode() === "normal") { setVimMode("visual"); return true }
    if (name === "i" && vimMode() === "normal") { setVimMode("insert"); return true }
    if (name === "a" && vimMode() === "normal") { renderable.moveCursorRight(); setVimMode("insert"); return true }
    if (name === "u" && vimMode() === "normal") { undo(); return true }
    if (name === "x" && vimMode() === "normal") { renderable.deleteChar(); syncVimMutation(); return true }
    if (name === "d" && vimPending === "d") { vimPending = ""; renderable.deleteLine(); syncVimMutation(); return true }
    if (name === "d" && vimMode() === "normal") { vimPending = "d"; return true }
    if (name === "g" && vimPending === "g") { vimPending = ""; renderable.gotoBufferHome(); updateCursor(); return true }
    if (name === "g" && vimMode() === "normal") { vimPending = "g"; return true }
    if (name === "g" && key.shift && vimMode() === "normal") { renderable.gotoBufferEnd(); updateCursor(); return true }
    vimPending = ""
    return true
  }

  function copy(copyToClipboard: (text: string) => boolean) {
    const text = selectedText(renderable)
    if (!text) return props.setStatus("Selecciona texto antes de copiar.")
    props.setStatus(copyToClipboard(text) ? "Copiado al portapapeles." : "El terminal no admite la copia al portapapeles.")
  }

  async function paste() {
    if (props.active() !== "editor" || !renderable) return
    try {
      const text = await readClipboard()
      if (!text) return props.setStatus("El portapapeles está vacío.")
      renderable.insertText(text)
      setContent(renderable.plainText)
      props.setStatus("Pegado desde el portapapeles.")
    } catch {
      props.setStatus("No se pudo leer el portapapeles.")
    }
  }

  function openFind() {
    if (!props.filePath()) return
    setFindOpen(true)
  }

  function updateFindQuery(value: string) {
    setFindQuery(value)
    setFindResults(findMatches(currentText(), value))
    setFindIndex(0)
  }

  function moveFindResult(direction: number) {
    setFindIndex((index) => Math.max(0, Math.min(index + direction, findResults().length - 1)))
  }

  function acceptFind() {
    const result = findResults()[findIndex()]
    if (!result || !renderable) return
    renderable.gotoLine(result.line - 1)
    renderable.setCursor(result.line - 1, result.column - 1)
    updateCursor()
    metrics.schedule()
    props.setStatus(`Coincidencia ${findIndex() + 1} de ${findResults().length}.`)
    setFindOpen(false)
  }

  function closeFind() {
    setFindOpen(false)
    setFindQuery("")
    setFindResults([])
    setFindIndex(0)
  }

  function resetFind() {
    setFindOpen(false)
    setFindQuery("")
    setFindResults([])
    setFindIndex(0)
  }

  function gotoLine(line: number) { renderable?.gotoLine(line) }
  function currentText() { return renderable?.plainText ?? content() }
  function blur() { renderable?.blur() }

  createEffect(() => {
    if (props.overlay() || findOpen() || props.active() !== "editor") renderable?.blur()
    else renderable?.focus()
  })

  return { content, setText, clear, detachEditor, currentText, blur, wrapMode, setLineWrap, cursor, vimMode, metrics, setEditor, onContentChange, onCursorChange, undo, redo, replaceCurrentText, handleVimKey, copy, paste, openFind, findOpen, findQuery, findResults, findIndex, updateFindQuery, moveFindResult, acceptFind, closeFind, resetFind, gotoLine }
}
