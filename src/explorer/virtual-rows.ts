export type VirtualRange = { start: number; end: number; top: number; bottom: number }

export function virtualRange(total: number, scrollTop: number, viewportHeight: number, overscan = 5): VirtualRange {
  const visible = Math.max(1, Math.ceil(viewportHeight))
  const start = Math.max(0, Math.min(total, Math.floor(scrollTop) - overscan))
  const end = Math.min(total, start + visible + overscan * 2)
  return { start, end, top: start, bottom: Math.max(0, total - end) }
}
