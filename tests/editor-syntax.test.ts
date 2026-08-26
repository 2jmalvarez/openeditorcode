import { expect, test } from "bun:test"
import { highlightEditor } from "../src/editor/syntax"

type Highlight = { line: number; start: number; end: number; priority?: number | null }

test("gives comments and strings precedence over nested tokens", () => {
  const highlights: Highlight[] = []
  const editor = {
    clearAllHighlights() {},
    addHighlight(line: number, highlight: Highlight) { highlights.push({ ...highlight, line }) },
  }

  highlightEditor(editor as never, "example.ts", 'const value = "return 42" // await 7')

  expect(highlights.filter((highlight) => highlight.priority && highlight.priority > 1).map(({ line, start, end, priority }) => ({ line, start, end, priority }))).toEqual([
    { line: 0, start: 26, end: 36, priority: 3 },
    { line: 0, start: 14, end: 25, priority: 2 },
  ])
})

test("does not treat hexadecimal colors as TSX comments", () => {
  const highlights: Highlight[] = []
  const editor = {
    clearAllHighlights() {},
    addHighlight(line: number, highlight: Highlight) { highlights.push({ ...highlight, line }) },
  }

  highlightEditor(editor as never, "example.tsx", '<text fg="#70d6a7">{props.value}</text>')

  expect(highlights.some((highlight) => highlight.priority === 3)).toBe(false)
})
