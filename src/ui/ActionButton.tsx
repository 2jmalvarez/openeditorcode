/** @jsxImportSource @opentui/solid */
import { createSignal } from "solid-js"
import { usePointer } from "./usePointer"

export function ActionButton(props: { id: string; label: string; disabled?: boolean; onPress: () => void }) {
  const [hovered, setHovered] = createSignal(false)
  const pointer = usePointer(() => !props.disabled)
  let pressed = false
  return <box id={props.id} flexShrink={0} height={1}
    onMouseOver={() => { setHovered(true); pointer.onMouseOver() }}
    onMouseOut={() => { pressed = false; setHovered(false); pointer.onMouseOut() }}
    onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); pressed = event.button === 0 && !props.disabled }}
    onMouseUp={(event) => {
      event.stopPropagation(); event.preventDefault()
      const activate = pressed && event.button === 0 && !props.disabled
      pressed = false
      if (activate) props.onPress()
    }}
    backgroundColor={!props.disabled && hovered() ? "#28404a" : "#17202a"}>
    <text fg={props.disabled ? "#71808b" : "#8ed1ff"}>{`[${props.label}]`}</text>
  </box>
}
