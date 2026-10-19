/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import type { Context } from "@opencode/plugin/tui/context"
import { onCleanup } from "solid-js"

/** Finish the original mouse dispatch before opening a host-owned dialog. */
export function FilesToggle(props: { context: Context; label: string; toggle: () => void }) {
  let button: BoxRenderable | undefined
  let pressed = false
  let disposed = false
  onCleanup(() => { disposed = true })
  props.context.keymap.layer(() => ({ target: () => button, commands: [
    { bind: "return,space", run: props.toggle },
  ] }))
  return <box id="oec-files-toggle" ref={(value) => { button = value }} focusable height={1}
    onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); pressed = event.button === 0 }}
    onMouseUp={(event) => {
      event.stopPropagation(); event.preventDefault()
      const activate = pressed && event.button === 0
      pressed = false
      if (activate) queueMicrotask(() => { if (!disposed) props.toggle() })
    }} onMouseOut={() => { pressed = false }}>
    <text fg={props.context.theme.text.base}>{props.label}</text>
  </box>
}
