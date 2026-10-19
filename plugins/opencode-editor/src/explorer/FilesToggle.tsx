/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import type { Context } from "@opencode/plugin/tui/context"
import { onCleanup } from "solid-js"

/** Finish the original mouse dispatch before opening a host-owned dialog. */
export function FilesToggle(props: { context: Context; label: string; toggle: () => void; id?: string; keyboardMode?: string; enabled?: () => boolean; onFocus?: () => void; onNext?: () => void; onExit?: () => void }) {
  let button: BoxRenderable | undefined
  let pressed = false
  let disposed = false
  onCleanup(() => { disposed = true })
  props.context.keymap.layer(() => ({ mode: props.keyboardMode, priority: 60, target: () => button, enabled: props.enabled?.() ?? true, commands: [
    { bind: "return,space", run: props.toggle },
    ...(props.onNext ? [{ bind: "tab,down", run: props.onNext }] : []),
    ...(props.onExit ? [{ bind: "escape,shift+tab", run: props.onExit }] : []),
  ] }))
  return <box id={props.id ?? "oec-files-toggle"} ref={(value) => { button = value }} focusable height={1} flexShrink={0} overflow="hidden"
    backgroundColor={props.context.theme.background.raised.base} on:focused={props.onFocus}
    onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); pressed = event.button === 0 }}
    onMouseUp={(event) => {
      event.stopPropagation(); event.preventDefault()
      const activate = pressed && event.button === 0
      pressed = false
     if (activate) queueMicrotask(() => { if (!disposed && props.enabled?.() !== false) props.toggle() })
    }} onMouseOut={() => { pressed = false }}>
    <text wrapMode="none" fg={props.context.theme.text.base}>{props.label}</text>
  </box>
}
