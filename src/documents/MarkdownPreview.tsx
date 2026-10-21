/** @jsxImportSource @opentui/solid */
import { SyntaxStyle } from "@opentui/core"
import type { Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { t } from "../localization"
import { renderMermaidBlocks } from "./mermaid"
import { MarkdownContent, markdownStyles } from "./MarkdownContent"

const styles = new WeakMap<object, SyntaxStyle>()
const colors = { text: "#d6e5dc", muted: "#8ca0ae", surface: "#151c23" }

export function MarkdownPreview(props: { content: Accessor<string>; active: Accessor<boolean>; manual: Accessor<boolean> }) {
  const renderer = useRenderer()
  // Parser work can outlive this view. Keep its style in the renderer's context.
  let markdownStyle = styles.get(renderer)
  if (!markdownStyle) {
    markdownStyle = SyntaxStyle.fromStyles(markdownStyles(colors), renderer.nativeScene)
    styles.set(renderer, markdownStyle)
  }
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
     <box style={{ height: 1, paddingX: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#8ca0ae">{t(props.manual() ? "preview.manual" : "preview.markdown")}</text></box>
    <scrollbox focused={props.active()} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, paddingX: 2, paddingY: 1 }}>
      <MarkdownContent content={renderMermaidBlocks(props.content())} syntaxStyle={markdownStyle} colors={colors} />
    </scrollbox>
  </box>
}
