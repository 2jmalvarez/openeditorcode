/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { Show, type Accessor } from "solid-js"
import { syntaxStyle } from "./syntax"
import type { FocusTarget } from "../workbench/types"

type Props = {
  filePath: Accessor<string | undefined>
  content: Accessor<string>
  active: Accessor<FocusTarget>
  wrapMode: Accessor<"none" | "word">
  lineLabels: Accessor<string>
  scrollbar: Accessor<string>
  setEditor: (editor: TextareaRenderable) => void
  setLineNumberScroll: (scroll: ScrollBoxRenderable) => void
  onContentChange: () => void
  onCursorChange: (line: number, visualColumn: number) => void
}

export function EditorPane(props: Props) {
  return <Show
    when={props.filePath()}
    fallback={<box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}><text fg="#71808b">Pulsa Ctrl+B y Enter para abrir un archivo</text></box>}
  >
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
      <scrollbox ref={(value) => { props.setLineNumberScroll(value); value.verticalScrollBar.visible = false }} style={{ width: 5, flexShrink: 0, paddingRight: 1, backgroundColor: "#151c23" }}>
        <text fg="#60717f">{props.lineLabels()}</text>
      </scrollbox>
      <textarea
        ref={props.setEditor}
        initialValue={props.content()}
        focused={props.active() === "editor"}
        wrapMode={props.wrapMode()}
        syntaxStyle={syntaxStyle}
        keyBindings={[
          ...defaultTextareaKeyBindings,
          { name: "z", ctrl: true, action: "undo" },
          { name: "z", ctrl: true, shift: true, action: "redo" },
        ]}
        style={{ flexGrow: 1, minWidth: 0, backgroundColor: "#101419", textColor: "#d6e5dc", cursorColor: "#70d6a7" }}
        onContentChange={props.onContentChange}
        onCursorChange={(value) => props.onCursorChange(value.line, value.visualColumn)}
      />
      <box style={{ width: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#60717f">{props.scrollbar()}</text></box>
    </box>
  </Show>
}
