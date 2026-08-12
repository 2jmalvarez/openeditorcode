export type DiffLine = { number: number; text: string; changed: boolean }

function lines(content: string): string[] {
  return content ? content.replace(/\n$/, "").split("\n") : []
}

export function alignDiff(previous: string, current: string): [DiffLine[], DiffLine[]] {
  const left = lines(previous)
  const right = lines(current)
  let prefix = 0
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1
  let suffix = 0
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix += 1
  const mark = (values: string[], start: number, end: number) => values.map((text, index) => ({ number: index + 1, text, changed: index >= start && index < end }))
  return [mark(left, prefix, left.length - suffix), mark(right, prefix, right.length - suffix)]
}
