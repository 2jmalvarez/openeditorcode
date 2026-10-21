/** @jsxImportSource @opentui/solid */
import { BoxRenderable, CodeRenderable, TextRenderable, type ColorInput, type MarkdownOptions, type StyleDefinitionInput, type SyntaxStyle } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { createMemo } from "solid-js"
import { prepareMarkdown } from "./markdown"

export type MarkdownColors = { text: ColorInput; muted: ColorInput; surface: ColorInput; light?: boolean }

export function markdownStyles(colors: MarkdownColors): Record<string, StyleDefinitionInput> {
  const accent = colors.light
    ? { green: "#176b48", blue: "#165ca8", amber: "#855900", violet: "#7945ad" }
    : { green: "#70d6a7", blue: "#8ed1ff", amber: "#f2c66d", violet: "#c4a7e7" }
  return {
    default: { fg: colors.text },
    conceal: { fg: colors.muted },
    "markup.heading": { fg: accent.green, bold: true },
    "markup.heading.1": { fg: accent.green, bold: true, underline: true },
    "markup.heading.2": { fg: accent.blue, bold: true },
    "markup.heading.3": { fg: accent.amber, bold: true },
    "markup.heading.4": { fg: accent.violet, bold: true },
    "markup.heading.5": { fg: accent.green, bold: true },
    "markup.heading.6": { fg: accent.blue, bold: true },
    "markup.strong": { fg: colors.text, bold: true },
    "markup.bold": { fg: colors.text, bold: true },
    "markup.italic": { fg: colors.text, italic: true },
    "markup.raw": { fg: accent.green, bg: colors.surface },
    "markup.raw.block": { fg: accent.green },
    "markup.link": { fg: accent.blue, underline: true },
    "markup.link.label": { fg: accent.blue, underline: true },
    "markup.link.url": { fg: accent.blue, underline: true },
    "markup.quote": { fg: colors.muted, italic: true },
    "markup.list": { fg: accent.amber, bold: true },
    "markup.list.checked": { fg: accent.green },
    "markup.list.unchecked": { fg: accent.amber },
    keyword: { fg: accent.violet, bold: true },
    string: { fg: accent.green },
    "string.special.url": { fg: accent.blue, underline: true },
    comment: { fg: colors.muted, italic: true },
    number: { fg: accent.amber },
    boolean: { fg: accent.amber },
    constant: { fg: accent.amber },
    function: { fg: accent.blue },
    type: { fg: accent.amber },
    operator: { fg: accent.violet },
    property: { fg: accent.blue },
    tag: { fg: accent.violet },
    attribute: { fg: accent.amber },
    punctuation: { fg: colors.muted },
  }
}

/** Shared presentation only: document state, focus and scrolling stay with callers. */
export function MarkdownContent(props: { id?: string; content: string; syntaxStyle: SyntaxStyle; colors: MarkdownColors }) {
  const renderer = useRenderer()
  const content = createMemo(() => prepareMarkdown(props.content))
  let block = 0
  const renderNode: MarkdownOptions["renderNode"] = (token, context) => {
    if (token.type !== "code") return undefined
    const code = context.defaultRender()
    if (!code) return undefined
    if (code instanceof CodeRenderable) {
      code.wrapMode = "word"
      code.bg = props.colors.surface
    }
    const id = `${props.id ?? "markdown"}-code-${block++}`
    const box = new BoxRenderable(renderer, { id, width: "100%", minWidth: 0, flexDirection: "column", flexShrink: 0,
      border: ["left"], borderColor: props.colors.muted, backgroundColor: props.colors.surface, paddingLeft: 1, paddingRight: 1, paddingBottom: 1 })
    const language = token.lang?.trim().split(/\s+/)[0] || "code"
    box.add(new TextRenderable(renderer, { id: `${id}-language`, content: language, fg: props.colors.muted, height: 1, flexShrink: 0 }))
    box.add(code)
    return box
  }
  // Apply content last: custom code renderers need the style during construction.
  return <markdown id={props.id} syntaxStyle={props.syntaxStyle} fg={props.colors.text}
    width="100%" minWidth={0} flexShrink={0} conceal streaming={false} internalBlockMode="top-level" renderNode={renderNode}
    tableOptions={{ style: "grid", widthMode: "full", columnFitter: "balanced", wrapMode: "word", cellPaddingX: 1, cellPaddingY: 0,
      selectable: true, borders: true, borderStyle: "rounded", borderColor: props.colors.muted }} content={content()} />
}
