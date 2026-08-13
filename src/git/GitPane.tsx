/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import type { GitFile, GitState } from "./status"
import type { GitTreeItem } from "./tree"
import { virtualRange } from "../explorer/virtual-rows"

type Props = {
  active: Accessor<boolean>
  state: Accessor<GitState>
  tree: Accessor<GitTreeItem[]>
  selected: Accessor<number>
  setScroll: (scroll: ScrollBoxRenderable) => void
  onActivate: (index: number) => void
}

const labels: Record<GitFile["status"], string> = { modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "?" }
const colors: Record<GitFile["status"], string> = { modified: "#f2c66d", added: "#70d6a7", deleted: "#ef7b7b", renamed: "#8ed1ff", untracked: "#b39ddb" }

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

  return <box style={{ width: 44, flexShrink: 0, minHeight: 0, flexDirection: "column", border: ["left"], borderColor: "#30404d" }}>
    <box style={{ height: 5, flexShrink: 0, paddingX: 1, paddingTop: 1, flexDirection: "column", border: ["bottom"], borderColor: "#30404d", backgroundColor: "#151c23" }}>
      <text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>CAMBIOS {props.state().files.length}</text>
      <Show when={props.state().available} fallback={<text fg="#71808b">{props.state().message}</text>}>
        <text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>{props.state().branch.slice(0, 31)}</text>
        <text fg="#71808b">{props.state().remoteStatus}</text>
      </Show>
    </box>
    <scrollbox ref={(value) => { scroll = value; props.setScroll(value); syncRange() }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0 }}>
      <Show when={range().top}><box style={{ height: range().top }} /></Show>
      <For each={rows()}>{(item, index) => { const logicalIndex = () => range().start + index(); return (
        <box onMouseDown={() => props.onActivate(logicalIndex())} style={{ paddingLeft: item.depth + 1, paddingRight: 1, flexDirection: "row", backgroundColor: logicalIndex() === props.selected() ? "#28404a" : undefined }}>
          <Show when={!item.directory}><text fg="#71808b">{item.fileNumber}.</text></Show>
          <text style={{ marginLeft: item.directory ? 0 : 1 }} fg={item.directory ? "#8ed1ff" : colors[item.file!.status]}>{item.directory ? item.expanded ? "▾" : "▸" : labels[item.file!.status]}</text>
          <box style={{ marginLeft: 1, flexGrow: 1, minWidth: 0 }}><text fg="#d6e5dc">{item.name}</text></box>
          <Show when={!item.directory && item.file!.additions !== null && item.file!.deletions !== null} fallback={<Show when={!item.directory}><text fg="#70d6a7">+?</text><text style={{ marginLeft: 1 }} fg="#ef7b7b">-?</text></Show>}>
            <text style={{ marginLeft: "auto" }} fg="#70d6a7">+{item.file!.additions}</text>
            <text style={{ marginLeft: 1 }} fg="#ef7b7b">-{item.file!.deletions}</text>
          </Show>
        </box>
      )}}</For>
      <Show when={range().bottom}><box style={{ height: range().bottom }} /></Show>
    </scrollbox>
  </box>
}
