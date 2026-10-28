import { useRenderer } from "@opentui/solid"
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js"

/** Pointer appearance is terminal-wide; restore it when a control leaves. */
export function usePointer(enabled: Accessor<boolean> = () => true) {
  const renderer = useRenderer()
  const [hovering, setHovering] = createSignal(false)
  function update(pointer: boolean) {
    renderer.setMousePointer(pointer ? "pointer" : "default")
    renderer.requestRender()
  }
  createEffect(() => { if (hovering()) update(enabled()) })
  onCleanup(() => { if (hovering()) update(false) })
  return {
    onMouseOver: () => { setHovering(true); update(enabled()) },
    onMouseOut: () => { setHovering(false); update(false) },
  }
}
