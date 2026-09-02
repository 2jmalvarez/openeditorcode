export type DiffSegment = { text: string; changed: boolean }
export type DiffCell = { number: number; text: string; segments: DiffSegment[] }
export type DiffRow = {
  kind: "unchanged" | "modified" | "removed" | "added"
  previous?: DiffCell
  current?: DiffCell
}
export type DiffOverviewMarker = { start: number; size: number }

type Operation = { kind: "equal" | "remove" | "add"; text: string; number: number; currentNumber?: number }

function lines(content: string): string[] {
  return content ? content.replace(/\n$/, "").split("\n") : []
}

function changedOperations(previous: string[], current: string[], previousOffset: number, currentOffset: number): Operation[] {
  if (previous.length === 0) return current.map((text, index) => ({ kind: "add", text, number: currentOffset + index + 1 }))
  if (current.length === 0) return previous.map((text, index) => ({ kind: "remove", text, number: previousOffset + index + 1 }))

  const trace: Map<number, number>[] = []
  let frontier = new Map<number, number>([[1, 0]])
  const maxDistance = Math.min(previous.length + current.length, 1000)

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    const next = new Map<number, number>()
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = frontier.get(diagonal + 1) ?? -1
      const right = frontier.get(diagonal - 1) ?? -1
      let x = diagonal === -distance || diagonal !== distance && right < down ? down : right + 1
      let y = x - diagonal

      while (x < previous.length && y < current.length && previous[x] === current[y]) {
        x += 1
        y += 1
      }
      next.set(diagonal, x)

      if (x >= previous.length && y >= current.length) {
        trace.push(next)
        return backtrack(trace, previous, current).map((operation) => operation.kind === "add"
          ? { ...operation, number: operation.number + currentOffset }
          : { ...operation, number: operation.number + previousOffset, currentNumber: operation.currentNumber === undefined ? undefined : operation.currentNumber + currentOffset })
      }
    }
    trace.push(next)
    frontier = next
  }

  return [
    ...previous.map((text, index): Operation => ({ kind: "remove", text, number: previousOffset + index + 1 })),
    ...current.map((text, index): Operation => ({ kind: "add", text, number: currentOffset + index + 1 })),
  ]
}

function operations(previous: string[], current: string[]): Operation[] {
  let prefix = 0
  while (prefix < previous.length && prefix < current.length && previous[prefix] === current[prefix]) prefix += 1
  let suffix = 0
  while (suffix < previous.length - prefix && suffix < current.length - prefix && previous[previous.length - suffix - 1] === current[current.length - suffix - 1]) suffix += 1

  const result: Operation[] = []
  for (let index = 0; index < prefix; index += 1) result.push({ kind: "equal", text: previous[index]!, number: index + 1, currentNumber: index + 1 })
  result.push(...changedOperations(
    previous.slice(prefix, previous.length - suffix),
    current.slice(prefix, current.length - suffix),
    prefix,
    prefix,
  ))
  for (let index = suffix; index > 0; index -= 1) {
    const previousNumber = previous.length - index + 1
    const currentNumber = current.length - index + 1
    result.push({ kind: "equal", text: previous[previousNumber - 1]!, number: previousNumber, currentNumber })
  }
  return result
}

function backtrack(trace: Map<number, number>[], previous: string[], current: string[]): Operation[] {
  const result: Operation[] = []
  let x = previous.length
  let y = current.length

  for (let distance = trace.length - 1; distance > 0; distance -= 1) {
    const frontier = trace[distance - 1]
    const diagonal = x - y
    const down = frontier.get(diagonal + 1) ?? -1
    const right = frontier.get(diagonal - 1) ?? -1
    const previousDiagonal = diagonal === -distance || diagonal !== distance && right < down ? diagonal + 1 : diagonal - 1
    const previousX = frontier.get(previousDiagonal) ?? 0
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      result.push({ kind: "equal", text: previous[x - 1]!, number: x, currentNumber: y })
      x -= 1
      y -= 1
    }
    if (x === previousX) {
      result.push({ kind: "add", text: current[y - 1]!, number: y })
      y -= 1
    } else {
      result.push({ kind: "remove", text: previous[x - 1]!, number: x })
      x -= 1
    }
  }

  while (x > 0 && y > 0) {
    result.push({ kind: "equal", text: previous[x - 1]!, number: x, currentNumber: y })
    x -= 1
    y -= 1
  }
  while (x > 0) {
    result.push({ kind: "remove", text: previous[x - 1]!, number: x })
    x -= 1
  }
  while (y > 0) {
    result.push({ kind: "add", text: current[y - 1]!, number: y })
    y -= 1
  }
  return result.reverse()
}

function unchangedCell(operation: Operation, number = operation.number): DiffCell {
  return { number, text: operation.text, segments: [{ text: operation.text, changed: false }] }
}

function changedSegments(previous: string, current: string): [DiffSegment[], DiffSegment[]] {
  const left = Array.from(previous)
  const right = Array.from(current)
  let prefix = 0
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1
  let suffix = 0
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix += 1

  const segments = (value: string[], end: number): DiffSegment[] => [
    { text: value.slice(0, prefix).join(""), changed: false },
    { text: value.slice(prefix, end).join(""), changed: true },
    { text: value.slice(end).join(""), changed: false },
  ].filter((segment) => segment.text.length > 0)

  return [segments(left, left.length - suffix), segments(right, right.length - suffix)]
}

export function alignDiff(previous: string, current: string): DiffRow[] {
  const result: DiffRow[] = []
  const changes = operations(lines(previous), lines(current))

  for (let index = 0; index < changes.length;) {
    const operation = changes[index]!
    if (operation.kind === "equal") {
      result.push({ kind: "unchanged", previous: unchangedCell(operation), current: unchangedCell(operation, operation.currentNumber!) })
      index += 1
      continue
    }

    const removed: Operation[] = []
    const added: Operation[] = []
    while (index < changes.length && changes[index]!.kind !== "equal") {
      const change = changes[index]!
      if (change.kind === "remove") removed.push(change)
      else added.push(change)
      index += 1
    }

    for (let row = 0; row < Math.max(removed.length, added.length); row += 1) {
      const left = removed[row]
      const right = added[row]
      if (left && right) {
        const [leftSegments, rightSegments] = changedSegments(left.text, right.text)
        result.push({
          kind: "modified",
          previous: { number: left.number, text: left.text, segments: leftSegments },
          current: { number: right.number, text: right.text, segments: rightSegments },
        })
      } else if (left) {
        result.push({ kind: "removed", previous: { number: left.number, text: left.text, segments: [{ text: left.text, changed: true }] } })
      } else if (right) {
        result.push({ kind: "added", current: { number: right.number, text: right.text, segments: [{ text: right.text, changed: true }] } })
      }
    }
  }

  return result
}

export function diffOverviewMarkers(rows: DiffRow[], side: "previous" | "current"): DiffOverviewMarker[] {
  const markers: DiffOverviewMarker[] = []
  const changed = (row: DiffRow) => side === "previous"
    ? row.kind === "removed" || row.kind === "modified"
    : row.kind === "added" || row.kind === "modified"

  for (let index = 0; index < rows.length;) {
    if (!changed(rows[index]!)) {
      index += 1
      continue
    }
    const start = index
    while (index < rows.length && changed(rows[index]!)) index += 1
    markers.push({ start: start / rows.length, size: (index - start) / rows.length })
  }
  return markers
}
