/** @jsxImportSource @opentui/solid */
import { basename } from "node:path"
import { For, type Accessor } from "solid-js"
import type { OpenTab } from "./types"

export type { OpenTab } from "./types"

type Props = {
  tabs: Accessor<OpenTab[]>
  activeTab: Accessor<number>
  dirty: Accessor<boolean>
  onActivate: (index: number) => void
  onClose: (index: number) => void
}

export function DocumentTabs(props: Props) {
  return <box style={{ flexShrink: 0, flexDirection: "row", flexWrap: "wrap", backgroundColor: "#111820" }}>
    <For each={props.tabs()}>{(tab, index) => (
      <box onMouseDown={() => props.onActivate(index())} style={{ paddingX: 1, flexShrink: 0, flexDirection: "row", backgroundColor: index() === props.activeTab() ? "#263a46" : "#111820" }}>
        <text fg={index() === props.activeTab() ? "#f2c66d" : "#8ca0ae"}>{index() === props.activeTab() && props.dirty() ? "* " : ""}{basename(tab.path)}</text>
        <text onMouseDown={(event) => { event.stopPropagation(); props.onClose(index()) }} style={{ marginLeft: 1 }} fg="#8ca0ae">×</text>
      </box>
    )}</For>
  </box>
}
