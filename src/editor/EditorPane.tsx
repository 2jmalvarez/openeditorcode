/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type TextareaRenderable } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { syntaxStyle } from "./syntax"
import type { FocusTarget } from "../workbench/types"

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
}

export function EditorPane(props: Props) {
  const renderer = useRenderer()
  const [welcomeNarrow, setWelcomeNarrow] = createSignal(false)

  function syncWelcomeWidth() {
    const centralWidth = renderer.width - (props.explorerVisible() ? 32 : 0) - (props.gitVisible() ? 44 : 0)
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
      <text style={{ marginTop: 1 }} fg="#8ca0ae">Editor de proyectos de codigo abierto para consola</text>
      <box style={{ marginTop: 1, width: "92%", height: 7, flexShrink: 0, paddingX: 2, paddingY: 1, flexDirection: "column", border: true, borderColor: "#f2c66d", backgroundColor: "#20272d" }}>
        <text fg="#f2c66d"><strong>ABRIR Y MOVERSE ENTRE PANELES</strong></text>
        <box style={{ height: 1, flexShrink: 0, marginTop: 1, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+B</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>ABRIR PANEL IZQUIERDO</strong></text></box>
        <box style={{ height: 1, flexShrink: 0, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+Alt+B</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>ABRIR PANEL DERECHO / CAMBIOS</strong></text></box>
        <box style={{ height: 1, flexShrink: 0, flexDirection: "row" }}><text fg="#70d6a7"><strong>Ctrl+Shift+← / →</strong></text><text style={{ marginLeft: "auto" }} fg="#ffffff"><strong>MOVERSE ENTRE PANELES</strong></text></box>
      </box>
      <box style={{ marginTop: 1, width: "92%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
        <box style={{ flexGrow: 1, flexBasis: 34, minWidth: 34, margin: 1, padding: 1, flexDirection: "column", border: true, borderColor: "#30404d", backgroundColor: "#151c23" }}>
          <text fg="#70d6a7"><strong>ARCHIVOS</strong></text>
          <box style={{ marginTop: 1, flexDirection: "row" }}><text fg="#f2c66d">F5</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Actualizar panel activo</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+N</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Nuevo archivo</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Supr</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Eliminar selección</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Abrir / expandir</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Shift+Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Contraer carpeta</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Shift+Enter</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Contraer árbol</text></box>
        </box>
        <box style={{ flexGrow: 1, flexBasis: 34, minWidth: 34, margin: 1, padding: 1, flexDirection: "column", border: true, borderColor: "#30404d", backgroundColor: "#151c23" }}>
          <text fg="#70d6a7"><strong>EDICION Y BUSQUEDA</strong></text>
          <box style={{ marginTop: 1, flexDirection: "row" }}><text fg="#f2c66d">Ctrl+P</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Paleta de comandos</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+F</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Buscar en archivo</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Alt+F</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Buscar en proyecto</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+S</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Guardar</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+W</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Cerrar pestaña</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Shift+Tab</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Siguiente pestaña</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+C / Ctrl+V</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Portapapeles</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Z / Ctrl+Shift+Z</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Deshacer / rehacer</text></box>
        </box>
      </box>
      </Show>
    </box>}
  >
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
      <box style={{ width: 5, flexShrink: 0, paddingRight: 1, backgroundColor: "#151c23" }}>
        <text fg="#60717f">{props.lineLabels()}</text>
      </box>
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
        onCursorChange={props.onCursorChange}
      />
      <box style={{ width: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#60717f">{props.scrollbar()}</text></box>
    </box>
  </Show>
}
