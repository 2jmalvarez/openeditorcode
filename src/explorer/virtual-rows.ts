export type VirtualRange = { start: number; end: number; top: number; bottom: number }

export function virtualRange(total: number, scrollTop: number, viewportHeight: number, overscan = 5): VirtualRange {
  const visible = Math.max(1, Math.ceil(viewportHeight))
  const start = Math.max(0, Math.min(total, Math.floor(scrollTop) - overscan))
  const end = Math.min(total, start + visible + overscan * 2)
  return { start, end, top: start, bottom: Math.max(0, total - end) }
}

/** Returns the nearest scroll position that fully exposes a one-line selected row. */
export function scrollTopForSelected(total: number, selected: number, scrollTop: number, viewportHeight: number): number {
  if (total <= 0 || viewportHeight <= 0) return 0
  const visible = Math.max(1, Math.floor(viewportHeight))
  const index = Math.max(0, Math.min(selected, total - 1))
  const maximum = Math.max(0, total - visible)
  if (index < scrollTop) return Math.min(index, maximum)
  if (index >= scrollTop + visible) return Math.min(index - visible + 1, maximum)
  return Math.max(0, Math.min(scrollTop, maximum))
}
