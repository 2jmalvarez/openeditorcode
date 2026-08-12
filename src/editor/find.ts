export type FindResult = {
  offset: number
  line: number
  column: number
  preview: string
}

export function findMatches(content: string, query: string, limit = 100): FindResult[] {
  if (!query) return []
  const needle = query.toLocaleLowerCase()
  const haystack = content.toLocaleLowerCase()
  const matches: FindResult[] = []
  let offset = 0
  let line = 1
  let lineStart = 0

  while (matches.length < limit) {
    const match = haystack.indexOf(needle, offset)
    if (match === -1) break
    for (let newline = content.indexOf("\n", offset); newline !== -1 && newline < match; newline = content.indexOf("\n", newline + 1)) {
      line += 1
      lineStart = newline + 1
    }
    const lineEnd = content.indexOf("\n", match)
    matches.push({
      offset: match,
      line,
      column: match - lineStart + 1,
      preview: content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 100),
    })
    offset = match + query.length
  }
  return matches
}
