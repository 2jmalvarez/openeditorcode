/** @jsxImportSource @opentui/solid */
import { basename } from "node:path"
import { For, type Accessor } from "solid-js"
import type { OpenTab } from "./types"

export type { OpenTab } from "./types"

type Props = {
  tabs: Accessor<OpenTab[]>
  activeTab: Accessor<number>
  dirty: Accessor<boolean>
}

export function DocumentTabs(props: Props) {
  return <scrollbox style={{ height: 2, flexShrink: 0, backgroundColor: "#111820" }}>
    <box style={{ flexDirection: "row" }}>
      <For each={props.tabs()}>{(tab, index) => (
        <box style={{ paddingX: 1, flexShrink: 0, backgroundColor: index() === props.activeTab() ? "#263a46" : "#111820" }}>
          <text fg={index() === props.activeTab() ? "#f2c66d" : "#8ca0ae"}>{index() === props.activeTab() && props.dirty() ? "* " : ""}{basename(tab.path)}</text>
        </box>
      )}</For>
    </box>
  </scrollbox>
}
