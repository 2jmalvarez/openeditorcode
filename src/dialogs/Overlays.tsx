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
import { t } from "../localization"

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
  pendingGitRevert: Accessor<{ path: string }[]>
  pendingExternalChange: Accessor<string | undefined>
  exclusionQuery: Accessor<string>
  setExclusionQuery: (value: string) => void
  exclusionIndex: Accessor<number>
  exclusionSuggestions: Accessor<ExclusionSuggestion[]>
  settingsIndex: Accessor<number>
  settingsScope: Accessor<"global" | "project">
  settingsValues: Accessor<string[]>
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
        <text fg="#70d6a7">{props.overlay() === "command-palette" ? t("overlay.palette") : props.overlay() === "project-search" ? t("overlay.projectSearch") : props.overlay() === "search-exclusions" ? t("overlay.exclusions") : t("overlay.newFile")}</text>
        <Show when={props.overlay() !== "new-file"} fallback={<box><text style={{ marginTop: 1 }} fg="#8ca0ae">{t("overlay.folder", { path: displayPath(props.root, props.newFileDirectory()) })}</text><input focused value={props.newFileName()} onInput={props.setNewFileName} placeholder={t("overlay.fileName")} style={{ marginTop: 1, backgroundColor: "#101419" }} /></box>}>
          <input focused value={props.overlay() === "search-exclusions" ? props.exclusionQuery() : props.query()} onInput={props.overlay() === "search-exclusions" ? props.setExclusionQuery : props.setQuery} placeholder={props.overlay() === "search-exclusions" ? t("overlay.pattern") : t("app.typeToSearch")} style={{ marginTop: 1, backgroundColor: "#101419" }} />
        </Show>
        <Show when={props.overlay() === "command-palette"} fallback={<box />}>
          <scrollbox scrollY style={{ flexGrow: 1, marginTop: 1 }}><For each={props.paletteResults()}>{(command, index) => <box style={{ flexDirection: "row", backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#d6e5dc">{command.title}</text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{command.shortcut}</text></box>}</For></scrollbox>
        </Show>
        <Show when={props.overlay() === "project-search"} fallback={<box />}>
          <scrollbox ref={(value) => { projectResultsScroll = value; value.verticalScrollBar.visible = true; scrollToSelectedProjectResult() }} scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}><Show when={!props.projectSearching()} fallback={<box><text fg="#8ca0ae">{t("overlay.searching")}</text></box>}><For each={groupedProjectResults(props.projectResults())}>{([path, results]) => <box style={{ flexDirection: "column", marginBottom: 1 }}><text fg="#8ed1ff">▾ {displayPath(props.root, path)}</text><For each={results}>{(result) => { const index = () => props.projectResults().indexOf(result); return <box id={`project-result-${index()}`} style={{ paddingLeft: 2, flexDirection: "row", backgroundColor: index() === props.searchIndex() ? "#28404a" : undefined }}><text fg="#f2c66d">L{result.line}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box> }}</For></box>}</For></Show></scrollbox>
        </Show>
        <Show when={props.overlay() === "search-exclusions"} fallback={<box />}>
          <scrollbox scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}><For each={props.exclusionSuggestions()}>{(item, index) => <box style={{ flexDirection: "row", backgroundColor: index() === props.exclusionIndex() ? "#28404a" : undefined }}><text fg={item.excluded ? "#c98b8b" : "#70d6a7"}>{item.excluded ? "●" : "○"} {item.pattern}</text><text style={{ marginLeft: "auto" }} fg="#71808b">{item.source === "gitignore" ? ".gitignore" : item.source === "session" ? t("overlay.session") : t("overlay.project")}</text></box>}</For></scrollbox>
        </Show>
        <text fg="#8ca0ae">{props.overlay() === "command-palette" ? t("overlay.paletteHelp") : props.overlay() === "project-search" ? t("overlay.projectHelp") : props.overlay() === "search-exclusions" ? t("overlay.exclusionHelp") : t("overlay.newFileHelp")}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "28%", left: "25%", width: "50%", height: 13, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">{t("overlay.confirmTitle")}</text><text style={{ marginTop: 1 }} fg="#b8c7d1">{t("overlay.confirmDescription")}</text>
        <box style={{ marginTop: 1, flexDirection: "column" }}><For each={props.pendingAction() === "update" ? [t("overlay.save"), t("overlay.saveUpdate"), t("overlay.updateWithoutSave")] : props.pendingAction() === "quit" ? [t("overlay.save"), t("overlay.saveQuit"), t("overlay.quitWithoutSave")] : [t("overlay.save"), t("overlay.saveClose"), t("overlay.closeWithoutSave")]}>{(label, index) => <box style={{ paddingX: 1, backgroundColor: index() === props.confirmChoice() ? "#6b5224" : undefined }}><text fg={index() === props.confirmChoice() ? "#ffffff" : "#d6e5dc"}>{index() === props.confirmChoice() ? "› " : "  "}{label}</text></box>}</For></box>
        <text fg="#8ca0ae">{t("overlay.confirmHelp")}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "delete-confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "30%", left: "25%", width: "50%", height: 10, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">{t("overlay.delete", { kind: props.pendingDeletion()?.directory ? t("overlay.directory") : t("overlay.file") })}</text>
        <text style={{ marginTop: 1 }} fg="#b8c7d1">{t("overlay.deleteQuestion", { name: props.pendingDeletion()?.name })}</text>
        <text fg="#b8c7d1">{props.pendingDeletion()?.directory ? t("overlay.deleteDirectory") : t("overlay.irreversible")}</text>
        <text style={{ marginTop: 1 }} fg="#8ca0ae">{t("overlay.actionHelp")}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "git-revert-confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "30%", left: "25%", width: "50%", height: 10, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">{t("overlay.discardGit")}</text>
        <text style={{ marginTop: 1 }} fg="#b8c7d1">{t("overlay.discardGitQuestion", { path: props.pendingGitRevert().length === 1 ? props.pendingGitRevert()[0].path : `${props.pendingGitRevert().length} archivos` })}</text>
        <text fg="#b8c7d1">{t("overlay.irreversible")}</text>
        <text style={{ marginTop: 1 }} fg="#8ca0ae">{t("overlay.actionHelp")}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "external-change-confirm"} fallback={<box />}>
      <box style={{ position: "absolute", top: "28%", left: "25%", width: "50%", height: 12, padding: 1, flexDirection: "column", backgroundColor: "#2a2020", border: true, borderColor: "#f2c66d" }}>
        <text fg="#f2c66d">{t("overlay.externalChange")}</text>
        <text style={{ marginTop: 1 }} fg="#b8c7d1">{t("overlay.externalChangeQuestion", { path: props.pendingExternalChange() })}</text>
        <box style={{ marginTop: 1, flexDirection: "column" }}><For each={[t("overlay.reload"), t("overlay.overwrite"), t("overlay.cancel")]}>{(label, index) => <box style={{ paddingX: 1, backgroundColor: index() === props.confirmChoice() ? "#6b5224" : undefined }}><text fg={index() === props.confirmChoice() ? "#ffffff" : "#d6e5dc"}>{index() === props.confirmChoice() ? "› " : "  "}{label}</text></box>}</For></box>
        <text fg="#8ca0ae">{t("overlay.confirmHelp")}</text>
      </box>
    </Show>
    <Show when={props.overlay() === "settings"} fallback={<box />}>
      <box style={{ position: "absolute", top: "16%", left: "20%", width: "60%", height: 17, padding: 1, flexDirection: "column", backgroundColor: "#17202a", border: true, borderColor: "#70d6a7" }}>
        <box style={{ flexDirection: "row" }}><text fg="#70d6a7"><strong>CONFIGURACIÓN</strong></text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{props.settingsScope() === "global" ? "GLOBAL" : "PROYECTO"}</text></box>
        <text style={{ marginTop: 1 }} fg="#8ca0ae">Los cambios se guardan en el JSON del ámbito activo.</text>
        <For each={["Ajuste de línea", "Números de línea", "Resaltado de sintaxis", "Formatear al guardar", "Perfil de teclado"]}>{(label, index) => <box style={{ marginTop: 1, paddingX: 1, flexDirection: "row", backgroundColor: index() === props.settingsIndex() ? "#28404a" : undefined }}><text fg={index() === props.settingsIndex() ? "#ffffff" : "#d6e5dc"}>{index() === props.settingsIndex() ? "› " : "  "}{label}</text><text style={{ marginLeft: "auto" }} fg="#f2c66d">{props.settingsValues()[index()]}</text></box>}</For>
        <text style={{ marginTop: 1 }} fg="#8ca0ae">↑↓ seleccionar  Enter cambiar  ←→ ámbito  E editar JSON  Esc cerrar</text>
      </box>
    </Show>
  </>
}
