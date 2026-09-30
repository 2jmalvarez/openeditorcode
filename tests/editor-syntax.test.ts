import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { createSyntaxTheme, highlightEditor } from "../src/editor/syntax"
import { formatDocument } from "../src/editor/format"
import { factoryConfig } from "../src/config/defaults"

type Highlight = { line: number; start: number; end: number; styleId?: number; priority?: number | null }

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

test("highlights SVG tags and attributes and paints complete six-digit hex colors", () => {
  const theme = createSyntaxTheme(factoryConfig().editor.syntax.styles)
  const highlights: Highlight[] = []
  const editor = {
    clearAllHighlights() { highlights.length = 0 },
    addHighlight(line: number, highlight: Highlight) { highlights.push({ ...highlight, line }) },
  }
  const text = '<svg fill="#70D6A7" stroke="#123" data-color="#12345678"><rect fill="#101419"/></svg>'
  highlightEditor(editor as never, "icon.SVG", text, theme)

  expect(highlights).toContainEqual({ line: 0, start: 0, end: 4, styleId: theme.ids.tag, priority: 1 })
  expect(highlights).toContainEqual({ line: 0, start: 5, end: 9, styleId: theme.ids.property, priority: 1 })
  expect(highlights).toContainEqual({ line: 0, start: text.indexOf("data-color"), end: text.indexOf("data-color") + 10, styleId: theme.ids.property, priority: 1 })
  expect(highlights.filter((highlight) => highlight.priority === 4).map(({ start, end }) => text.slice(start, end))).toEqual(["#70D6A7", "#101419"])
  expect(theme.style.getStyle("color.#70d6a7")?.bg?.equals(RGBA.fromHex("#70d6a7"))).toBe(true)
  expect(theme.style.getStyle("color.#101419")?.fg?.equals(RGBA.fromHex("#ffffff"))).toBe(true)
})

test("paints hex literals in text and strings but ignores incomplete or extended values", () => {
  const theme = createSyntaxTheme(factoryConfig().editor.syntax.styles)
  const highlights: Highlight[] = []
  const editor = {
    clearAllHighlights() {},
    addHighlight(line: number, highlight: Highlight) { highlights.push({ ...highlight, line }) },
  }
  const text = 'color: #ffffff; short: #abc; long: #12345678; id: #abcdefg; text: "#000000";'
  highlightEditor(editor as never, "style.css", text, theme)
  expect(highlights.filter((highlight) => highlight.priority === 4).map(({ start, end }) => text.slice(start, end))).toEqual(["#ffffff", "#000000"])
  expect(theme.style.getStyle("color.#ffffff")?.fg?.equals(RGBA.fromHex("#101419"))).toBe(true)
})

test("formats SVG with the default Prettier configuration", async () => {
  const config = factoryConfig()
  expect(config.editor.formatting.byExtension[".svg"]).toBe("prettier")
  expect(await formatDocument("icon.svg", '<svg><rect fill="#70d6a7"/></svg>', config)).toBe('<svg><rect fill="#70d6a7" /></svg>\n')
})
