import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, on, untrack } from "solid-js"
import { scrollTopForSelected, virtualRange } from "../../../../src/explorer/virtual-rows"

/** A manual viewport is independent of selection until the user navigates again. */
export function useTreeViewport(props: {
  owner: () => object; navigation: () => number; total: () => number; selected: () => number
  selectedEnd?: () => number
  savedTop?: () => number; remember?: (top: number) => void
}) {
  let scroll: ScrollBoxRenderable | undefined
  let restore: number | undefined = untrack(() => props.savedTop?.() ?? 0)
  let reveal = false
  let previousHeight = 0
  const owner = createMemo(props.owner)
  const navigation = createMemo(props.navigation)
  const totalRows = createMemo(props.total)
  const [range, setRange] = createSignal(virtualRange(props.total(), restore, 1))
  const updateRange = (total: number, top: number, height: number) => {
    const next = virtualRange(total, top, height)
    const previous = range()
    if (next.start !== previous.start || next.end !== previous.end || next.bottom !== previous.bottom) setRange(next)
  }

  // Populate a newly mounted/loaded tree before its first frame, without moving it.
  createEffect(on(totalRows, (total) => updateRange(total, scroll?.scrollTop ?? restore ?? 0, scroll?.viewport.height ?? 1)))

  // Memo equality matters: polling/loading revisions are not navigation events.
  createEffect(on([owner, navigation], ([current], previous) => {
    if (previous && previous[0] !== current) {
      restore = props.savedTop?.() ?? 0
      reveal = false
    } else if (previous) reveal = true
  }))

  const measure = () => untrack(() => {
    if (!scroll || scroll.isDestroyed) return
    const total = props.total()
    const selected = props.selected()
    const height = scroll.viewport.height
    if (height <= 0) return
    const ready = scroll.scrollHeight >= total
    const wasVisible = selected >= scroll.scrollTop && selected < scroll.scrollTop + previousHeight
    if (previousHeight && height !== previousHeight && wasVisible) reveal = true
    previousHeight = height
    // Virtual spacers may need one layout pass before native scroll bounds grow.
    if (ready) {
      const maximum = Math.max(0, total - Math.floor(height))
      if (restore !== undefined) { scroll.scrollTop = Math.min(restore, maximum); restore = undefined }
      if (reveal) {
        const end = props.selectedEnd?.() ?? selected
        // Reveal the full logical row when it fits, otherwise prioritize its start.
        const bottom = scrollTopForSelected(total, end, scroll.scrollTop, height)
        scroll.scrollTop = scrollTopForSelected(total, selected, bottom, height)
        reveal = false
      }
      else if (scroll.scrollTop > maximum) scroll.scrollTop = maximum
      props.remember?.(scroll.scrollTop)
    }
    updateRange(total, scroll.scrollTop, height)
  })

  return {
    range, measure, attach: (value: ScrollBoxRenderable) => { scroll = value },
    pageSize: () => Math.max(1, Math.floor(scroll?.viewport.height ?? 1)),
  }
}
