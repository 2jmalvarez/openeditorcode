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

  while (matches.length < limit) {
    const match = haystack.indexOf(needle, offset)
    if (match === -1) break
    const lineStart = content.lastIndexOf("\n", match - 1) + 1
    const lineEnd = content.indexOf("\n", match)
    matches.push({
      offset: match,
      line: content.slice(0, match).split("\n").length,
      column: match - lineStart + 1,
      preview: content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 100),
    })
    offset = match + query.length
  }
  return matches
}
