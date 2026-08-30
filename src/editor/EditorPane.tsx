/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import type { SyntaxTheme } from "./syntax"
import type { FocusTarget } from "../workbench/types"
import { editorWidth } from "../workbench/layout"
import type { OecConfig } from "../config/types"
import { t } from "../localization"

type Props = {
  filePath: Accessor<string | undefined>
  content: Accessor<string>
  active: Accessor<FocusTarget>
  explorerVisible: Accessor<boolean>
  gitVisible: Accessor<boolean>
  wrapMode: Accessor<"none" | "word">
  lineLabels: Accessor<string>
  scrollbar: Accessor<string>
  setEditor: (editor: TextareaRenderable) => void
  onContentChange: () => void
  onCursorChange: () => void
  onUnmount: () => void
  config: Accessor<OecConfig>
  syntaxTheme: Accessor<SyntaxTheme>
}

export function EditorPane(props: Props) {
  const renderer = useRenderer()
  const [welcomeNarrow, setWelcomeNarrow] = createSignal(false)

  function syncWelcomeWidth() {
    const centralWidth = editorWidth(renderer.width, props.explorerVisible(), props.gitVisible(), props.config().layout)
    setWelcomeNarrow(centralWidth < 32)
  }

  createEffect(syncWelcomeWidth)
  onMount(() => renderer.on("resize", syncWelcomeWidth))
  onCleanup(() => {
    renderer.off("resize", syncWelcomeWidth)
    props.onUnmount()
  })
  return <Show
    when={props.filePath()}
    fallback={<box style={{ flexGrow: 1, paddingX: welcomeNarrow() ? 0 : 4, justifyContent: "center", alignItems: "center", flexDirection: "column", backgroundColor: "#101419" }}>
      <Show when={!welcomeNarrow()} fallback={<text fg="#70d6a7"><strong>{"O\nE\nC"}</strong></text>}>
      <box style={{ paddingX: 3, paddingY: 1, border: true, borderColor: "#70d6a7", backgroundColor: "#17202a" }}>
        <text fg="#70d6a7"><strong>{"  OOOO    EEEEEE   CCCCC \n O    O   EE       CC     \n O    O   EEEE     CC     \n O    O   EE       CC     \n  OOOO    EEEEEE   CCCCC "}</strong></text>
      </box>
      <text style={{ marginTop: 1 }} fg="#70d6a7"><strong>OpenEditorCode</strong></text>
       <text style={{ marginTop: 1 }} fg="#8ca0ae">{t("welcome.tagline")}</text>
      <box style={{ marginTop: 1, width: "92%", height: 7, flexShrink: 0, paddingX: 2, paddingY: 1, flexDirection: "column", border: true, borderColor: "#f2c66d", backgroundColor: "#20272d" }}>
        <text fg="#f2c66d"><strong>{t("welcome.openPanels")}</strong></text>
        <box style={{ height: 1, flexShrink: 0, marginTop: 1, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+B</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>{t("welcome.toggleExplorer")}</strong></text></box>
        <box style={{ height: 1, flexShrink: 0, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+Alt+B</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>{t("welcome.toggleChanges")}</strong></text></box>
        <box style={{ height: 1, flexShrink: 0, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+Shift+← / →</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>{t("welcome.movePanels")}</strong></text></box>
      </box>
      <box style={{ marginTop: 1, width: "92%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
        <box style={{ flexGrow: 1, flexBasis: 34, minWidth: 34, margin: 1, padding: 1, flexDirection: "column", border: true, borderColor: "#30404d", backgroundColor: "#151c23" }}>
          <text fg="#70d6a7"><strong>{t("welcome.files")}</strong></text>
          <box style={{ marginTop: 1, flexDirection: "row" }}><text fg="#f2c66d">F5</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.refresh")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+N</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.newFile")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Supr</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.delete")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.open")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Shift+Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.collapseFolder")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Shift+Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.collapseTree")}</text></box>
        </box>
        <box style={{ flexGrow: 1, flexBasis: 34, minWidth: 34, margin: 1, padding: 1, flexDirection: "column", border: true, borderColor: "#30404d", backgroundColor: "#151c23" }}>
          <text fg="#70d6a7"><strong>{t("welcome.editing")}</strong></text>
          <box style={{ marginTop: 1, flexDirection: "row" }}><text fg="#f2c66d">Ctrl+P</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.palette")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+F</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.findFile")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Alt+F</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.findProject")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+S</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.save")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+W</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.closeTab")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Shift+Tab</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.nextTab")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+C / Ctrl+V</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.clipboard")}</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Z / Ctrl+Shift+Z</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">{t("welcome.undoRedo")}</text></box>
        </box>
      </box>
      </Show>
    </box>}
  >
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
        <Show when={props.config().editor.lineNumbers}><box style={{ width: 5, flexShrink: 0, paddingRight: 1, backgroundColor: "#151c23" }}>
          <text fg="#60717f">{props.lineLabels()}</text>
        </box></Show>
      <textarea
        ref={props.setEditor}
        initialValue={props.content()}
        focused={props.active() === "editor"}
        wrapMode={props.wrapMode()}
        syntaxStyle={props.config().editor.syntax.enabled ? props.syntaxTheme().style : undefined}
        keyBindings={[
          ...defaultTextareaKeyBindings,
          { name: "z", ctrl: true, action: "undo" },
          { name: "z", ctrl: true, shift: true, action: "redo" },
        ]}
        style={{ flexGrow: 1, minWidth: 0, backgroundColor: "#101419", textColor: props.config().editor.syntax.styles.default.foreground, cursorColor: "#70d6a7" }}
        onContentChange={props.onContentChange}
        onCursorChange={props.onCursorChange}
      />
      <box style={{ width: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#60717f">{props.scrollbar()}</text></box>
    </box>
  </Show>
}
