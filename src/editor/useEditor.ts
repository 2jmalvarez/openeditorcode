import type { TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal } from "solid-js"
import { readClipboard, selectedText } from "./clipboard"
import { findMatches, type FindResult } from "./find"
import { useEditorMetrics } from "./useEditorMetrics"
import type { FocusTarget } from "../workbench/types"

type Props = {
  active: () => FocusTarget
  overlay: () => unknown
  filePath: () => string | undefined
  setStatus: (status: string) => void
}

export function useEditor(props: Props) {
  const [content, setContent] = createSignal("")
  const [wrapMode, setWrapMode] = createSignal<"none" | "word">("none")
  const [cursor, setCursor] = createSignal({ line: 1, column: 1 })
  const [findOpen, setFindOpen] = createSignal(false)
  const [findQuery, setFindQuery] = createSignal("")
  const [findResults, setFindResults] = createSignal<FindResult[]>([])
  const [findIndex, setFindIndex] = createSignal(0)
  let renderable: TextareaRenderable | undefined
  let replacingText = false
  const metrics = useEditorMetrics({ editor: () => renderable, filePath: props.filePath, content })

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
    if (renderable) renderable.wrapMode = mode
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

  return { content, setText, clear, detachEditor, currentText, blur, wrapMode, setLineWrap, cursor, metrics, setEditor, onContentChange, onCursorChange, undo, redo, copy, paste, openFind, findOpen, findQuery, findResults, findIndex, updateFindQuery, moveFindResult, acceptFind, closeFind, resetFind, gotoLine }
}
