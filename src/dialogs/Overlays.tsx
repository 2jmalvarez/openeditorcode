/** @jsxImportSource @opentui/solid */
import { For, Show, type Accessor } from "solid-js"
import { displayPath } from "../explorer/tree"
import type { ProjectSearchResult } from "../search/project-search"
import type { Overlay } from "../workbench/types"

export type Command = { title: string; shortcut: string; run: () => void }

type Props = {
  root: string
  overlay: Accessor<Overlay>
  query: Accessor<string>
  setQuery: (value: string) => void
  newFileName: Accessor<string>
  setNewFileName: (value: string) => void
  newFileDirectory: Accessor<string>
  searchIndex: Accessor<number>
  paletteResults: Accessor<Command[]>
  projectResults: Accessor<ProjectSearchResult[]>
  projectSearching: Accessor<boolean>
  confirmChoice: Accessor<number>
}

export function Overlays(props: Props) {
  return <>
    <Show when={props.overlay() === "command-palette" || props.overlay() === "text-search" || props.overlay() === "project-search" || props.overlay() === "new-file"} fallback={<box />}>
      <box style={{ position: "absolute", top: "20%", left: "15%", width: "70%", height: "55%", padding: 1, flexDirection: "column", backgroundColor: "#1b252e", border: true, borderColor: "#70d6a7" }}>
        <text fg="#70d6a7">{props.overlay() === "command-palette" ? "COMANDOS Y CONFIGURACIÓN" : props.overlay() === "project-search" ? "BUSCAR EN TODO EL PROYECTO" : props.overlay() === "new-file" ? "NUEVO ARCHIVO" : "BUSCAR EN EL ARCHIVO"}</text>
        <Show when={props.overlay() !== "new-file"} fallback={<box><text style={{ marginTop: 1 }} fg="#8ca0ae">Carpeta: {displayPath(props.root, props.newFileDirectory())}</text><input focused value={props.newFileName()} onInput={props.setNewFileName} placeholder="nombre.ext" style={{ marginTop: 1, backgroundColor: "#101419" }} /></box>}>
          <input focused value={props.query()} onInput={props.setQuery} placeholder="Escribe para buscar..." style={{ marginTop: 1, backgroundColor: "#101419" }} />
        </Show>
        <Show when={props.overlay() === "command-palette"} fallback={<box />}>
          <scrollbox scrollY style={{ flexGrow: 1, marginTop: 1 }}><For each={props.paletteResults()}>{(command, index) => <box style={{ flexDirection: "row", backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#d6e5dc">{command.title}</text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{command.shortcut}</text></box>}</For></scrollbox>
        </Show>
        <Show when={props.overlay() === "project-search"} fallback={<box />}>
          <scrollbox style={{ flexGrow: 1, marginTop: 1 }}><Show when={!props.projectSearching()} fallback={<box><text fg="#8ca0ae">Buscando...</text></box>}><For each={props.projectResults()}>{(result, index) => <box style={{ backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#f2c66d">{displayPath(props.root, result.path)}:{result.line}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box>}</For></Show></scrollbox>
        </Show>
        <text fg="#8ca0ae">{props.overlay() === "command-palette" ? "Flechas seleccionar | Enter ejecutar | Esc cerrar" : props.overlay() === "project-search" ? "Enter buscar | Flechas resultado | Enter abrir | Esc cerrar" : props.overlay() === "new-file" ? "Enter crear | Esc cancelar" : "Enter buscar siguiente | Esc cerrar"}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "28%", left: "25%", width: "50%", height: 13, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">Hay cambios sin guardar.</text><text style={{ marginTop: 1 }} fg="#b8c7d1">Elige qué hacer con el archivo actual.</text>
        <box style={{ marginTop: 1, flexDirection: "column" }}><For each={["Guardar", "Guardar y cerrar", "Cerrar sin guardar"]}>{(label, index) => <box style={{ paddingX: 1, backgroundColor: index() === props.confirmChoice() ? "#6b5224" : undefined }}><text fg={index() === props.confirmChoice() ? "#ffffff" : "#d6e5dc"}>{index() === props.confirmChoice() ? "› " : "  "}{label}</text></box>}</For></box>
        <text fg="#8ca0ae">Flechas arriba/abajo | Enter confirmar | Esc cancelar</text>
      </box>
    </Show>
  </>
}
