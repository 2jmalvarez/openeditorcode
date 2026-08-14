/** @jsxImportSource @opentui/solid */
import { SyntaxStyle } from "@opentui/core"
import type { Accessor } from "solid-js"

const markdownStyle = SyntaxStyle.fromStyles({
  default: { fg: "#d6e5dc" },
  conceal: { fg: "#60717f", dim: true },
  "markup.heading.1": { fg: "#70d6a7", bold: true },
  "markup.heading.2": { fg: "#8ed1ff", bold: true },
  "markup.heading.3": { fg: "#f2c66d", bold: true },
  "markup.heading.4": { fg: "#f2c66d", bold: true },
  "markup.heading.5": { fg: "#d6e5dc", bold: true },
  "markup.heading.6": { fg: "#d6e5dc", bold: true },
  "markup.strong": { fg: "#ffffff", bold: true },
  "markup.italic": { fg: "#d6e5dc", italic: true },
  "markup.raw": { fg: "#a5d6a7" },
  "markup.raw.block": { fg: "#a5d6a7" },
  "markup.link": { fg: "#8ed1ff", underline: true },
  "markup.quote": { fg: "#8ca0ae", italic: true },
  "markup.list": { fg: "#f2c66d" },
})

export function MarkdownPreview(props: { content: Accessor<string>; active: Accessor<boolean>; manual: Accessor<boolean> }) {
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
    <box style={{ height: 1, paddingX: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#8ca0ae">{props.manual() ? "MANUAL DE OEC · SOLO LECTURA" : "PREVIEW MARKDOWN · Ctrl+Alt+M editar"}</text></box>
    <scrollbox focused={props.active()} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, paddingX: 2, paddingY: 1 }}>
      <markdown content={props.content()} syntaxStyle={markdownStyle} conceal streaming={false} tableOptions={{ style: "grid", widthMode: "full", wrapMode: "word", selectable: true, borders: true, borderColor: "#30404d" }} />
    </scrollbox>
  </box>
}
