/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { For, Show, type Accessor } from "solid-js"
import type { GitFile, GitState } from "./status"
import type { GitTreeItem } from "./tree"

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
  return <box style={{ width: 34, flexShrink: 0, flexDirection: "column", border: ["left"], borderColor: "#30404d" }}>
    <box style={{ paddingX: 1, paddingY: 1, flexDirection: "column" }}>
      <text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>CAMBIOS</text>
      <Show when={props.state().available} fallback={<text fg="#71808b">{props.state().message}</text>}>
        <text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>{props.state().branch}</text>
        <text fg="#71808b">{props.state().remoteStatus}</text>
      </Show>
    </box>
    <scrollbox ref={props.setScroll} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1 }}>
      <For each={props.tree()}>{(item, index) => (
        <box onMouseDown={() => props.onActivate(index())} style={{ paddingLeft: item.depth + 1, paddingRight: 1, flexDirection: "row", backgroundColor: index() === props.selected() ? "#28404a" : undefined }}>
          <text fg={item.directory ? "#8ed1ff" : colors[item.file!.status]}>{item.directory ? item.expanded ? "▾" : "▸" : labels[item.file!.status]}</text>
          <text style={{ marginLeft: 1 }} fg="#d6e5dc">{item.name}</text>
        </box>
      )}</For>
    </scrollbox>
  </box>
}
