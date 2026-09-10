/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import type { GitFile, GitState } from "./status"
import type { GitTreeItem } from "./tree"
import type { GitMode } from "./useGit"
import { virtualRange } from "../explorer/virtual-rows"
import { t } from "../localization"

type Props = {
  active: Accessor<boolean>
  state: Accessor<GitState>
  tree: Accessor<GitTreeItem[]>
  selected: Accessor<number>
  commitMessage: Accessor<string>
  setCommitMessage: (value: string) => void
  commitFocused: Accessor<boolean>
  setScroll: (scroll: ScrollBoxRenderable) => void
  onActivate: (index: number) => void
  width: Accessor<number>
  mode?: Accessor<GitMode>
  historyTitle?: Accessor<string>
  loading?: Accessor<boolean>
}

const labels: Record<GitFile["status"], string> = { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "?" }
const colors: Record<GitFile["status"], string> = { modified: "#f2c66d", added: "#70d6a7", deleted: "#ef7b7b", renamed: "#8ed1ff", untracked: "#b39ddb" }

function remoteLabel(status: string) {
  const match = status.match(/^(?:(\d+) adelante)?(?:, )?(?:(\d+) atrás)?$/)
  if (!match) return status
  return [match[1] && `↑${match[1]}`, match[2] && `↓${match[2]}`].filter(Boolean).join(" ")
}

export function GitPane(props: Props) {
  const renderer = useRenderer()
  const [range, setRange] = createSignal(virtualRange(props.tree().length, 0, 50))
  const rows = createMemo(() => props.tree().slice(range().start, range().end))
  let scroll: ScrollBoxRenderable | undefined

  function syncRange() {
    if (!scroll) return
    const next = virtualRange(props.tree().length, scroll.scrollTop, scroll.viewport.height || scroll.height)
    const current = range()
    if (next.start !== current.start || next.end !== current.end || next.bottom !== current.bottom) setRange(next)
  }

  onMount(() => renderer.on("frame", syncRange))
  onCleanup(() => renderer.off("frame", syncRange))

  return <box style={{ width: props.width(), flexShrink: 0, minHeight: 0, flexDirection: "column", border: ["left"], borderColor: "#30404d" }}>
    <box style={{ minHeight: 3, flexShrink: 0, paddingX: 1, paddingY: 1, flexDirection: "column", border: ["bottom"], borderColor: "#30404d", backgroundColor: "#151c23" }}>
      <Show when={props.state().available} fallback={<text fg="#71808b">{props.state().message}</text>}>
        <box style={{ minWidth: 0 }}><text wrapMode="char" fg={props.active() ? "#70d6a7" : "#8ca0ae"}>{props.state().branch}</text></box>
        <text style={{ alignSelf: "flex-end" }} fg="#71808b">{remoteLabel(props.state().remoteStatus)}</text>
      </Show>
      <Show when={props.mode && props.mode() !== "local"}><text fg="#8ed1ff">{props.historyTitle?.()}</text><text fg="#71808b">{props.loading?.() ? "Cargando..." : props.tree().length ? "Solo lectura" : "Sin resultados"}</text></Show>
    </box>
    <scrollbox ref={(value) => { scroll = value; props.setScroll(value); syncRange() }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0 }}>
      <Show when={range().top}><box style={{ height: range().top }} /></Show>
      <For each={rows()}>{(item, index) => { const logicalIndex = () => range().start + index(); return (
        <box onMouseDown={() => props.onActivate(logicalIndex())} style={{ height: 1, flexShrink: 0, overflow: "hidden", paddingLeft: item.depth + 1, paddingRight: 1, flexDirection: "row", backgroundColor: logicalIndex() === props.selected() ? "#28404a" : undefined }}>
          <Show when={item.file}><text fg="#71808b">{item.fileNumber}.</text></Show>
          <text style={{ marginLeft: item.directory ? 0 : 1 }} fg={item.file ? colors[item.file.status] : "#8ed1ff"}>{item.directory ? item.expanded ? "▾" : "▸" : item.file ? labels[item.file.status] : item.commit ? "#" : item.loadMore ? "+" : ""}</text>
          <box style={{ marginLeft: 1, flexGrow: 1, minWidth: 0, height: 1, overflow: "hidden" }}><text fg="#d6e5dc">{item.name}</text></box>
          <Show when={item.file && item.file.additions !== null && item.file.deletions !== null} fallback={<Show when={item.file && (!props.mode || props.mode() === "local")}><text fg="#70d6a7">+?</text><text style={{ marginLeft: 1 }} fg="#ef7b7b">-?</text></Show>}>
            <text style={{ marginLeft: "auto" }} fg="#70d6a7">+{item.file!.additions}</text>
            <text style={{ marginLeft: 1 }} fg="#ef7b7b">-{item.file!.deletions}</text>
          </Show>
        </box>
      )}}</For>
      <Show when={range().bottom}><box style={{ height: range().bottom }} /></Show>
    </scrollbox>
    <box style={{ flexShrink: 0, paddingX: 1, paddingBottom: 1, flexDirection: "column", border: ["top"], borderColor: "#30404d", backgroundColor: "#151c23" }}>
      <Show when={!props.mode || props.mode() === "local"} fallback={<text fg="#71808b">Enter: abrir | Esc: volver</text>}>
        <input focused={props.active() && props.commitFocused()} value={props.commitMessage()} onInput={props.setCommitMessage} placeholder={t("app.commitMessage")} style={{ backgroundColor: "#101419" }} />
        <box style={{ flexDirection: "row" }}><text fg="#71808b">{t("app.gitHelp")}</text><text style={{ marginLeft: "auto" }} fg="#71808b">{t("app.gitSyncHelp")}</text></box>
      </Show>
      <text fg="#71808b">F8: historial | F9: ramas</text>
    </box>
  </box>
}
