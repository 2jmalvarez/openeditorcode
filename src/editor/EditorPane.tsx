/** @jsxImportSource @opentui/solid */
import { defaultTextareaKeyBindings, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { onCleanup, Show, type Accessor } from "solid-js"
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
  onCursorChange: () => void
  onUnmount: () => void
}

export function EditorPane(props: Props) {
  onCleanup(props.onUnmount)
  return <Show
    when={props.filePath()}
    fallback={<box style={{ flexGrow: 1, paddingX: 4, justifyContent: "center", alignItems: "center", flexDirection: "column", backgroundColor: "#101419" }}>
      <box style={{ paddingX: 3, paddingY: 1, border: true, borderColor: "#70d6a7", backgroundColor: "#17202a" }}>
        <text fg="#70d6a7"><strong>{"  OOOO    EEEEEE   CCCCC \n O    O   EE       CC     \n O    O   EEEE     CC     \n O    O   EE       CC     \n  OOOO    EEEEEE   CCCCC "}</strong></text>
      </box>
      <text style={{ marginTop: 1 }} fg="#70d6a7"><strong>OpenEditorCode</strong></text>
      <text style={{ marginTop: 1 }} fg="#8ca0ae">Editor de proyectos de codigo abierto para consola</text>
      <box style={{ marginTop: 3, width: "92%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
        <box style={{ flexGrow: 1, flexBasis: 34, minWidth: 34, margin: 1, padding: 1, flexDirection: "column", border: true, borderColor: "#30404d", backgroundColor: "#151c23" }}>
          <text fg="#70d6a7"><strong>ARCHIVOS Y NAVEGACION</strong></text>
          <box style={{ marginTop: 1, flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Shift+←</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Foco a la izquierda</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Shift+→</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Foco a la derecha</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+B</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Mostrar / ocultar explorador</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">Ctrl+Alt+B</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Control de cambios</text></box>
          <box style={{ flexDirection: "row" }}><text fg="#f2c66d">F5</text><text style={{ marginLeft: "auto" }} fg="#d6e5dc">Actualizar archivos</text></box>
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
    </box>}
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
        onCursorChange={props.onCursorChange}
      />
      <box style={{ width: 1, flexShrink: 0, backgroundColor: "#151c23" }}><text fg="#60717f">{props.scrollbar()}</text></box>
    </box>
  </Show>
}
