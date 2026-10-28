/** @jsxImportSource @opentui/solid */
import { ScrollBarRenderable, type BoxRenderable, type MouseEvent, type TextareaRenderable } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js"

/** Native scrollbars shared by the standalone editor and the host plugin. */
export function EditorScrollFrame(props: { editor: () => TextareaRenderable | undefined; gutter: number; foreground: string; background: string; children: JSX.Element }) {
  const renderer = useRenderer()
  let verticalHost!: BoxRenderable
  let horizontalHost!: BoxRenderable
  let vertical: ScrollBarRenderable | undefined
  let horizontal: ScrollBarRenderable | undefined
  let syncing = false
  let dirty = true
  let width = 0
  let measuredWidth = -1
  let measuredWrap = ""
  const [horizontalHeight, setHorizontalHeight] = createSignal(0)

  const invalidate = () => { dirty = true }
  function move(x: number, y: number) {
    const editor = props.editor()
    if (!editor || editor.isDestroyed) return
    const view = editor.editorView.getViewport()
    const rows = editor.editorView.getTotalVirtualLineCount()
    const nextX = Math.max(0, Math.min(x, width - view.width))
    const nextY = Math.max(0, Math.min(y, rows - view.height))
    if (nextX === view.offsetX && nextY === view.offsetY) return
    const selecting = editor.hasSelection()
    // Match OpenTUI's wheel behavior: keep the native cursor inside the new
    // viewport, otherwise its next paint immediately scrolls back to the cursor.
    editor.editorView.setViewport(nextX, nextY, view.width, view.height, !selecting)
    if (editor.wrapMode === "none" && !selecting) {
      const cursor = editor.logicalCursor
      const margin = Math.min(Math.max(1, Math.floor(view.width * 0.2)), Math.floor((view.width - 1) / 2))
      const column = Math.max(nextX + margin, Math.min(cursor.col, nextX + view.width - margin - 1))
      const lines = editor.editorView.getLogicalLineInfo()
      let row = cursor.row
      // A short line cannot hold the horizontal cursor position. Prefer a
      // nearby visible long line rather than letting native cursor-follow undo
      // the horizontal scroll (e.g. a short header above a long source line).
      if ((lines.lineWidthCols[row] ?? 0) < nextX + margin) {
        let distance = Infinity
        for (let candidate = nextY; candidate < Math.min(lines.lineWidthCols.length, nextY + view.height); candidate++) {
          if ((lines.lineWidthCols[candidate] ?? 0) >= nextX + margin && Math.abs(candidate - cursor.row) < distance) {
            row = candidate
            distance = Math.abs(candidate - cursor.row)
          }
        }
      }
      if (column !== cursor.col || row !== cursor.row) editor.setCursor(row, column)
      editor.editorView.setViewport(nextX, nextY, view.width, view.height, false)
    }
    editor.requestRender()
    sync()
  }
  function wheel(event: MouseEvent) {
    const editor = props.editor()
    if (!editor || !event.scroll) return
    const { direction, delta } = event.scroll
    const horizontalWheel = direction === "left" || direction === "right" || event.modifiers.shift
    if (!horizontalWheel) return
    event.stopPropagation()
    sync()
    const view = editor.editorView.getViewport()
    // OpenTUI invokes its built-in handler even after preventDefault(). Consume
    // the delta before that handler runs, rather than scrolling twice.
    const backwards = direction === "up" || direction === "left"
    event.scroll.direction = backwards ? "left" : "right"
    event.scroll.delta = 0
    if (editor.wrapMode === "none") move(view.offsetX + (backwards ? -delta : delta), view.offsetY)
  }
  function sync() {
    const editor = props.editor()
    if (!editor || editor.isDestroyed || !vertical || !horizontal || editor.width < 1 || editor.height < 1) return
    if (dirty || measuredWidth !== editor.width || measuredWrap !== editor.wrapMode) {
      width = editor.wrapMode === "none" ? editor.editorView.measureForDimensions(editor.width, editor.height)?.widthColsMax ?? 0 : 0
      measuredWidth = editor.width
      measuredWrap = editor.wrapMode
      dirty = false
    }
    const view = editor.editorView.getViewport()
    const rows = editor.editorView.getTotalVirtualLineCount()
    const x = Math.max(0, Math.min(view.offsetX, width - view.width))
    const y = Math.max(0, Math.min(view.offsetY, rows - view.height))
    if (x !== view.offsetX || y !== view.offsetY) {
      editor.editorView.setViewport(x, y, view.width, view.height, false)
      editor.requestRender()
    }
    syncing = true
    try {
      vertical.viewportSize = view.height
      vertical.scrollSize = rows
      vertical.scrollPosition = y
      horizontal.viewportSize = view.width
      horizontal.scrollSize = width
      horizontal.scrollPosition = x
      const barHeight = width > view.width ? 1 : 0
      setHorizontalHeight(barHeight)
    } finally { syncing = false }
  }
  createEffect(() => {
    const editor = props.editor()
    if (!editor) return
    dirty = true
    editor.onMouseScroll = wheel
    editor.editBuffer.on("content-changed", invalidate)
    onCleanup(() => {
      editor.editBuffer.off("content-changed", invalidate)
      if (!editor.isDestroyed) editor.onMouseScroll = undefined
    })
  })
  onMount(() => {
    const trackOptions = { foregroundColor: props.foreground, backgroundColor: props.background }
    vertical = new ScrollBarRenderable(renderer, { orientation: "vertical", width: 1, height: "100%", trackOptions, onChange: (position) => {
      const editor = props.editor()
      if (!syncing && editor) move(editor.editorView.getViewport().offsetX, position)
    } })
    horizontal = new ScrollBarRenderable(renderer, { orientation: "horizontal", width: "100%", height: 1, trackOptions, onChange: (position) => {
      const editor = props.editor()
      if (!syncing && editor) move(position, editor.editorView.getViewport().offsetY)
    } })
    verticalHost.add(vertical)
    horizontalHost.add(horizontal)
    renderer.on("frame", sync)
    sync()
  })
  onCleanup(() => renderer.off("frame", sync))
  return <box flexGrow={1} flexShrink={1} flexBasis={0} minWidth={0} minHeight={0} flexDirection="column">
    <box height={0} flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0} minWidth={0} flexDirection="row">
      {props.children}
      <box ref={verticalHost} width={1} flexShrink={0} backgroundColor={props.background} />
    </box>
    <box ref={horizontalHost} height={horizontalHeight()} flexBasis="auto" flexShrink={0} marginLeft={props.gutter} marginRight={1} minWidth={0} backgroundColor={props.background} />
  </box>
}
