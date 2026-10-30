/** @jsxImportSource @opentui/solid */
import { TextAttributes, type BoxRenderable } from "@opentui/core"
import type { Context } from "@opencode/plugin/tui/context"
import { createSignal, onCleanup } from "solid-js"
import { usePointer } from "../../../../src/ui/usePointer"

/** Finish the original mouse dispatch before opening a host-owned dialog. */
export function FilesToggle(props: { context: Context; label: string; toggle: () => void; id?: string; button?: boolean; gap?: number; flexGrow?: number; keyboardMode?: string; enabled?: () => boolean; onFocus?: () => void; onNext?: () => void; onExit?: () => void }) {
  const pointer = usePointer(() => props.enabled?.() !== false)
  let button: BoxRenderable | undefined
  let pressed = false
  let disposed = false
  const [hovered, setHovered] = createSignal(false)
  const [focused, setFocused] = createSignal(false)
  const active = () => props.button && props.enabled?.() !== false && (hovered() || focused())
  onCleanup(() => { disposed = true })
  props.context.keymap.layer(() => ({ mode: props.keyboardMode, priority: 60, target: () => button, enabled: props.enabled?.() ?? true, commands: [
    { bind: "return,space", run: props.toggle },
    ...(props.onNext ? [{ bind: "tab,down", run: props.onNext }] : []),
    ...(props.onExit ? [{ bind: "escape,shift+tab", run: props.onExit }] : []),
  ] }))
  return <box id={props.id ?? "oec-files-toggle"} ref={(value) => { button = value }} focusable height={1} flexGrow={props.flexGrow} minWidth={0} flexShrink={0} marginLeft={props.button ? props.gap ?? 1 : 0} overflow="hidden"
    backgroundColor={active() ? props.context.theme.text.base : props.button ? props.context.theme.background.base : props.context.theme.background.raised.base}
    on:focused={() => { setFocused(true); props.onFocus?.() }} on:blurred={() => setFocused(false)}
    onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); pressed = event.button === 0 }}
    onMouseUp={(event) => {
      event.stopPropagation(); event.preventDefault()
      const activate = pressed && event.button === 0
      pressed = false
     if (activate) queueMicrotask(() => { if (!disposed && props.enabled?.() !== false) props.toggle() })
    }} onMouseOver={() => { setHovered(true); pointer.onMouseOver() }} onMouseOut={() => { pressed = false; setHovered(false); pointer.onMouseOut() }}>
    <text wrapMode="none" attributes={props.button ? TextAttributes.BOLD : 0} fg={active() ? props.context.theme.background.base : props.context.theme.text.base}>{props.button ? `[${props.label}]` : props.label}</text>
  </box>
}
