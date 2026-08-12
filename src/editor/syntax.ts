import { SyntaxStyle, type TextareaRenderable } from "@opentui/core"
import { extname } from "node:path"

export const syntaxStyle = SyntaxStyle.fromStyles({
  default: { fg: "#d6e5dc" },
  keyword: { fg: "#79c0ff", bold: true },
  string: { fg: "#a5d6a7" },
  comment: { fg: "#7d8590", italic: true, dim: true },
  number: { fg: "#e3b341" },
  tag: { fg: "#ffab70", bold: true },
  property: { fg: "#d2a8ff" },
})

const styleIds = Object.fromEntries(
  ["keyword", "string", "comment", "number", "tag", "property"].map((name) => [name, syntaxStyle.getStyleId(name)!]),
) as Record<"keyword" | "string" | "comment" | "number" | "tag" | "property", number>

const patterns = {
  comment: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//g,
  string: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
  number: /\b(?:\d[\d_]*(?:\.\d+)?)\b/g,
  keyword: /\b(?:abstract|and|as|async|await|bool|break|case|catch|class|const|continue|def|default|else|enum|export|false|finally|for|from|function|if|import|in|interface|let|new|null|or|pass|private|protected|public|return|self|static|string|switch|this|throw|true|try|type|undefined|var|void|while)\b/g,
  tag: /<\/?[A-Za-z][\w:-]*/g,
  property: /\b[A-Za-z_$][\w$-]*(?=\s*:)/g,
}

// Regex highlighting scales with the whole document; preserve editor responsiveness for large files.
const MAX_HIGHLIGHTED_CHARACTERS = 200_000

function addMatches(editor: TextareaRenderable, text: string, expression: RegExp, styleId: number) {
  for (const [lineIndex, line] of text.split("\n").entries()) {
    expression.lastIndex = 0
    for (let match = expression.exec(line); match; match = expression.exec(line)) {
      editor.addHighlight(lineIndex, { start: match.index, end: match.index + match[0].length, styleId })
    }
  }
}

export function highlightEditor(editor: TextareaRenderable | undefined, path: string | undefined, text: string) {
  if (!editor) return
  editor.clearAllHighlights()
  const extension = extname(path || "").toLocaleLowerCase()
  if (text.length > MAX_HIGHLIGHTED_CHARACTERS || !new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md", ".py", ".yml", ".yaml", ".sh"]).has(extension)) return

  addMatches(editor, text, patterns.comment, styleIds.comment)
  addMatches(editor, text, patterns.string, styleIds.string)
  addMatches(editor, text, patterns.number, styleIds.number)
  addMatches(editor, text, patterns.keyword, styleIds.keyword)
  if (extension === ".html" || extension === ".tsx" || extension === ".jsx") addMatches(editor, text, patterns.tag, styleIds.tag)
  if (extension === ".json" || extension === ".yml" || extension === ".yaml" || extension === ".css") addMatches(editor, text, patterns.property, styleIds.property)
}
