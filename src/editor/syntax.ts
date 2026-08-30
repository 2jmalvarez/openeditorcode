import { SyntaxStyle, type TextareaRenderable } from "@opentui/core"
import { extname } from "node:path"
import type { SyntaxTokenStyle } from "../config/types"

type HighlightToken = "keyword" | "string" | "comment" | "number" | "tag" | "property"
export type SyntaxTheme = { style: SyntaxStyle; ids: Record<HighlightToken, number> }

export function createSyntaxTheme(styles: Record<string, SyntaxTokenStyle>): SyntaxTheme {
  const style = SyntaxStyle.fromStyles(Object.fromEntries(Object.entries(styles).map(([name, value]) => [name, { fg: value.foreground, bold: value.bold, italic: value.italic, dim: value.dim }])))
  return { style, ids: Object.fromEntries(["keyword", "string", "comment", "number", "tag", "property"].map((name) => [name, style.getStyleId(name)!])) as Record<HighlightToken, number> }
}

const fallbackTheme = createSyntaxTheme({
  default: { foreground: "#d6e5dc" }, keyword: { foreground: "#79c0ff", bold: true }, string: { foreground: "#a5d6a7" },
  comment: { foreground: "#7d8590", italic: true, dim: true }, number: { foreground: "#e3b341" }, tag: { foreground: "#ffab70", bold: true }, property: { foreground: "#d2a8ff" },
})

const patterns = {
  slashComment: /\/\/[^\n]*/g,
  hashComment: /#[^\n]*/g,
  blockComment: /\/\*[\s\S]*?\*\//g,
  string: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
  number: /\b(?:\d[\d_]*(?:\.\d+)?)\b/g,
  keyword: /\b(?:abstract|and|as|async|await|bool|break|case|catch|class|const|continue|def|default|else|enum|export|false|finally|for|from|function|if|import|in|interface|let|new|null|or|pass|private|protected|public|return|self|static|string|switch|this|throw|true|try|type|undefined|var|void|while)\b/g,
  tag: /<\/?[A-Za-z][\w:-]*/g,
  property: /\b[A-Za-z_$][\w$-]*(?=\s*:)/g,
}

// Regex highlighting scales with the whole document; preserve editor responsiveness for large files.
const MAX_HIGHLIGHTED_CHARACTERS = 200_000
const slashCommentExtensions = new Set([".ts", ".tsx", ".js", ".jsx"])
const hashCommentExtensions = new Set([".py", ".yml", ".yaml", ".sh"])
const blockCommentExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"])

function addMatches(editor: TextareaRenderable, text: string, expression: RegExp, styleId: number, priority = 1) {
  for (const [lineIndex, line] of text.split("\n").entries()) {
    expression.lastIndex = 0
    for (let match = expression.exec(line); match; match = expression.exec(line)) {
      editor.addHighlight(lineIndex, { start: match.index, end: match.index + match[0].length, styleId, priority })
    }
  }
}

export function highlightEditor(editor: TextareaRenderable | undefined, path: string | undefined, text: string, theme = fallbackTheme) {
  if (!editor) return
  editor.clearAllHighlights()
  const extension = extname(path || "").toLocaleLowerCase()
  if (text.length > MAX_HIGHLIGHTED_CHARACTERS || !new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md", ".py", ".yml", ".yaml", ".sh"]).has(extension)) return

  // Comments and strings must win when their ranges overlap token-like content.
  if (slashCommentExtensions.has(extension)) addMatches(editor, text, patterns.slashComment, theme.ids.comment, 3)
  if (hashCommentExtensions.has(extension)) addMatches(editor, text, patterns.hashComment, theme.ids.comment, 3)
  if (blockCommentExtensions.has(extension)) addMatches(editor, text, patterns.blockComment, theme.ids.comment, 3)
  addMatches(editor, text, patterns.string, theme.ids.string, 2)
  addMatches(editor, text, patterns.number, theme.ids.number)
  addMatches(editor, text, patterns.keyword, theme.ids.keyword)
  if (extension === ".html" || extension === ".tsx" || extension === ".jsx") addMatches(editor, text, patterns.tag, theme.ids.tag)
  if (extension === ".json" || extension === ".yml" || extension === ".yaml" || extension === ".css") addMatches(editor, text, patterns.property, theme.ids.property)
}
