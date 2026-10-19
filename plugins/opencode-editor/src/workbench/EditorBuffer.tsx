/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type TextareaRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createSyntaxTheme } from "../../../../src/editor/syntax"
import { useEditorMetrics } from "../../../../src/editor/useEditorMetrics"
import { factoryConfig } from "../../../../src/config/defaults"
import type { EditorController } from "../integration/controller"
import type { Document } from "../documents/workspace"
import { useRevision } from "./reactive"

export type BufferHandle = { capture: () => void; editor: () => TextareaRenderable | undefined }

export function EditorBuffer(props: { controller: EditorController; document: Document; focused: () => boolean; onFocus: () => void; onHandle: (handle: BufferHandle | undefined) => void }) {
  const { controller, document } = props
  const revision = useRevision(controller.workspace)
  const controllerRevision = useRevision(controller)
  const wrapMode = createMemo(() => { controllerRevision(); return controller.wrapMode })
  // Cursor notifications can precede content notifications in OpenTUI. A
  // position-only revision must not restore the old document over typed text.
  const content = createMemo(() => { revision(); return document.content })
  const theme = createSyntaxTheme(factoryConfig().editor.syntax.styles)
  const [renderable, setRenderable] = createSignal<TextareaRenderable>()
  let replacing = false
  let ready = false
  const metrics = useEditorMetrics({ editor: renderable, filePath: () => document.path, content: () => { revision(); return document.content }, syntaxTheme: () => theme })
  const rememberPosition = () => {
    const editor = renderable()
    if (!ready || !editor || editor.isDestroyed) return
    const cursor = editor.logicalCursor
    const viewport = editor.editorView.getViewport()
    controller.workspace.remember(document.path, { row: cursor.row, column: cursor.col, scrollX: viewport.offsetX, scrollY: viewport.offsetY })
  }
  const capture = () => {
    const editor = renderable()
    if (!ready || !editor || editor.isDestroyed) return
    controller.workspace.edit(document.path, editor.plainText)
    rememberPosition()
  }
  const handle: BufferHandle = { capture, editor: renderable }
  const restorePosition = (editor: TextareaRenderable) => {
    const position = document.position
    const lines = document.content.split("\n")
    const row = Math.min(position.row, Math.max(0, lines.length - 1))
    editor.setCursor(row, Math.min(position.column, Bun.stringWidth(lines[row] ?? "")))
    // Wrapped rows are visual, not buffer lines. In unwrapped mode clamp against
    // the full buffer, not only the currently materialized virtual viewport.
    const rows = wrapMode() === "none" ? editor.lineCount : Math.max(editor.lineCount, editor.virtualLineCount)
    editor.editorView.setViewport(wrapMode() === "none" ? position.scrollX : 0, Math.min(position.scrollY, Math.max(0, rows - editor.height)), editor.width, editor.height, false)
  }
  const restore = () => {
    const editor = renderable()
    if (!editor || editor.width < 1 || editor.height < 1) return
    controller.context.renderer.off("frame", restore)
    restorePosition(editor)
    ready = true
    metrics.refresh()
  }
  const frame = () => {
    const editor = renderable()
    // `focused` is a desired state, not a guarantee: host dialogs and route
    // transitions can blur a renderable without changing the Solid prop.
    // Reconcile only while this route owns input, never over a host modal.
    if (editor && !editor.isDestroyed && props.focused() && controller.context.keymap.mode.current() === "oec-editor" && !editor.focused) editor.focus()
    if (ready) { metrics.syncScroll(); rememberPosition() }
  }
  createEffect(() => {
    const text = content()
    const editor = renderable()
    if (!editor) return
    if (editor.plainText !== text) {
      replacing = true
      editor.setText(text)
      restorePosition(editor)
      replacing = false
    }
    metrics.scheduleHighlight(document.path, text)
  })
  createEffect(() => {
    const mode = wrapMode()
    const editor = renderable()
    if (!editor) return
    const cursor = editor.logicalCursor
    editor.wrapMode = mode
    editor.setCursor(cursor.row, cursor.col)
    metrics.schedule()
    metrics.scheduleHighlight(document.path, editor.plainText, 16)
  })
  onMount(() => {
    props.onHandle(handle)
    controller.capture = capture
    controller.context.renderer.on("frame", restore)
    controller.context.renderer.on("frame", frame)
    metrics.scheduleHighlight(document.path, document.content, 0)
  })
  onCleanup(() => {
    capture()
    if (controller.capture === capture) controller.capture = undefined
    props.onHandle(undefined)
    controller.context.renderer.off("frame", restore)
    controller.context.renderer.off("frame", frame)
    // SyntaxStyle native resources are owned by this view, not the host renderer.
    theme.style.destroy()
  })
  return <box flexGrow={1} minHeight={0} minWidth={0} flexDirection="row" onMouseDown={props.onFocus}>
    <box width={6} paddingRight={1} flexShrink={0}><text fg={controller.context.theme.text.muted}>{metrics.lineLabels()}</text></box>
    <textarea id="oec-editor-buffer" ref={setRenderable} initialValue={document.content} focused={props.focused()} wrapMode={controller.wrapMode} syntaxStyle={theme.style}
      keyBindings={[...defaultTextareaKeyBindings, { name: "z", ctrl: true, action: "undo" }, { name: "z", ctrl: true, shift: true, action: "redo" }]}
      flexGrow={1} minWidth={0} textColor={controller.context.theme.text.base} backgroundColor={controller.context.theme.background.base}
      onContentChange={() => { if (!replacing) { const editor = renderable(); if (editor) controller.workspace.edit(document.path, editor.plainText); metrics.schedule() } }}
      onCursorChange={() => { if (!replacing) rememberPosition() }} />
    <text width={1} fg={controller.context.theme.text.muted}>{metrics.scrollbar()}</text>
  </box>
}
