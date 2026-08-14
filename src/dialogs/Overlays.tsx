/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, onCleanup, For, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { displayPath } from "../explorer/tree"
import type { ProjectSearchResult } from "../search/project-search"
import type { Overlay, PendingAction } from "../workbench/types"
import type { TreeItem } from "../explorer/tree"
import type { Command } from "./types"
import type { ExclusionSuggestion } from "../search/useSearchExclusions"

function groupedProjectResults(results: ProjectSearchResult[]) {
  const groups = new Map<string, ProjectSearchResult[]>()
  for (const result of results) groups.set(result.path, [...(groups.get(result.path) ?? []), result])
  return [...groups.entries()]
}

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
  pendingDeletion: Accessor<TreeItem | undefined>
  pendingAction: Accessor<PendingAction | undefined>
  exclusionQuery: Accessor<string>
  setExclusionQuery: (value: string) => void
  exclusionIndex: Accessor<number>
  exclusionSuggestions: Accessor<ExclusionSuggestion[]>
}

export function Overlays(props: Props) {
  const renderer = useRenderer()
  let projectResultsScroll: ScrollBoxRenderable | undefined
  let pendingScroll: (() => void) | undefined

  function scrollToSelectedProjectResult() {
    const index = props.searchIndex()
    if (pendingScroll) renderer.off("frame", pendingScroll)
    pendingScroll = () => {
      renderer.off("frame", pendingScroll!)
      pendingScroll = undefined
      projectResultsScroll?.scrollChildIntoView(`project-result-${index}`)
    }
    renderer.on("frame", pendingScroll)
  }

  createEffect(() => {
    if (props.overlay() !== "project-search") return
    props.searchIndex()
    props.projectResults().length
    scrollToSelectedProjectResult()
  })

  onCleanup(() => { if (pendingScroll) renderer.off("frame", pendingScroll) })

  return <>
    <Show when={props.overlay() === "command-palette" || props.overlay() === "project-search" || props.overlay() === "search-exclusions" || props.overlay() === "new-file"} fallback={<box />}>
      <box style={{ position: "absolute", top: "20%", left: "15%", width: "70%", height: "55%", padding: 1, flexDirection: "column", backgroundColor: "#1b252e", border: true, borderColor: "#70d6a7" }}>
        <text fg="#70d6a7">{props.overlay() === "command-palette" ? "COMANDOS Y CONFIGURACIÓN" : props.overlay() === "project-search" ? "BUSCAR EN TODO EL PROYECTO" : props.overlay() === "search-exclusions" ? "EXCLUSIONES DE BÚSQUEDA" : "NUEVO ARCHIVO"}</text>
        <Show when={props.overlay() !== "new-file"} fallback={<box><text style={{ marginTop: 1 }} fg="#8ca0ae">Carpeta: {displayPath(props.root, props.newFileDirectory())}</text><input focused value={props.newFileName()} onInput={props.setNewFileName} placeholder="nombre.ext" style={{ marginTop: 1, backgroundColor: "#101419" }} /></box>}>
          <input focused value={props.overlay() === "search-exclusions" ? props.exclusionQuery() : props.query()} onInput={props.overlay() === "search-exclusions" ? props.setExclusionQuery : props.setQuery} placeholder={props.overlay() === "search-exclusions" ? "Carpeta o patrón..." : "Escribe para buscar..."} style={{ marginTop: 1, backgroundColor: "#101419" }} />
        </Show>
        <Show when={props.overlay() === "command-palette"} fallback={<box />}>
          <scrollbox scrollY style={{ flexGrow: 1, marginTop: 1 }}><For each={props.paletteResults()}>{(command, index) => <box style={{ flexDirection: "row", backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#d6e5dc">{command.title}</text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{command.shortcut}</text></box>}</For></scrollbox>
        </Show>
        <Show when={props.overlay() === "project-search"} fallback={<box />}>
          <scrollbox ref={(value) => { projectResultsScroll = value; value.verticalScrollBar.visible = true; scrollToSelectedProjectResult() }} scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}><Show when={!props.projectSearching()} fallback={<box><text fg="#8ca0ae">Buscando...</text></box>}><For each={groupedProjectResults(props.projectResults())}>{([path, results]) => <box style={{ flexDirection: "column", marginBottom: 1 }}><text fg="#8ed1ff">▾ {displayPath(props.root, path)}</text><For each={results}>{(result) => { const index = () => props.projectResults().indexOf(result); return <box id={`project-result-${index()}`} style={{ paddingLeft: 2, flexDirection: "row", backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#f2c66d">L{result.line}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box> }}</For></box>}</For></Show></scrollbox>
        </Show>
        <Show when={props.overlay() === "search-exclusions"} fallback={<box />}>
          <scrollbox scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}><For each={props.exclusionSuggestions()}>{(item, index) => <box style={{ flexDirection: "row", backgroundColor: index() === props.exclusionIndex() ? "#28404a" : undefined }}><text fg={item.excluded ? "#c98b8b" : "#70d6a7"}>{item.excluded ? "●" : "○"} {item.pattern}</text><text style={{ marginLeft: "auto" }} fg="#71808b">{item.source === "gitignore" ? ".gitignore" : item.source === "session" ? "sesión" : "proyecto"}</text></box>}</For></scrollbox>
        </Show>
        <text fg="#8ca0ae">{props.overlay() === "command-palette" ? "Flechas seleccionar | Enter ejecutar | Esc cerrar" : props.overlay() === "project-search" ? "Enter buscar | Ctrl+E exclusiones | Esc cerrar" : props.overlay() === "search-exclusions" ? "Tab completar | Enter alternar | Supr quitar | Esc volver" : props.overlay() === "new-file" ? "Enter crear | Esc cancelar" : "Enter buscar siguiente | Esc cerrar"}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "28%", left: "25%", width: "50%", height: 13, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">Hay cambios sin guardar.</text><text style={{ marginTop: 1 }} fg="#b8c7d1">Elige qué hacer con los cambios pendientes.</text>
        <box style={{ marginTop: 1, flexDirection: "column" }}><For each={props.pendingAction() === "update" ? ["Guardar", "Guardar y actualizar", "Actualizar sin guardar"] : props.pendingAction() === "quit" ? ["Guardar", "Guardar y salir", "Salir sin guardar"] : ["Guardar", "Guardar y cerrar", "Cerrar sin guardar"]}>{(label, index) => <box style={{ paddingX: 1, backgroundColor: index() === props.confirmChoice() ? "#6b5224" : undefined }}><text fg={index() === props.confirmChoice() ? "#ffffff" : "#d6e5dc"}>{index() === props.confirmChoice() ? "› " : "  "}{label}</text></box>}</For></box>
        <text fg="#8ca0ae">Flechas arriba/abajo | Enter confirmar | Esc cancelar</text>
      </box>
    </Show>
    <Show when={props.overlay() === "delete-confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "30%", left: "25%", width: "50%", height: 10, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">Eliminar {props.pendingDeletion()?.directory ? "carpeta" : "archivo"}</text>
        <text style={{ marginTop: 1 }} fg="#b8c7d1">¿Quieres eliminar {props.pendingDeletion()?.name}?</text>
        <text fg="#b8c7d1">{props.pendingDeletion()?.directory ? "También se eliminará todo su contenido." : "Esta acción no se puede deshacer."}</text>
        <text style={{ marginTop: 1 }} fg="#8ca0ae">Enter confirmar | Esc cancelar</text>
      </box>
    </Show>
  </>
}
