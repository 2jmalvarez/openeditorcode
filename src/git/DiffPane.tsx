/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { alignDiff, diffOverviewMarkers, type DiffCell, type DiffRow } from "./diff"
import type { GitDiff } from "./status"
import { t } from "../localization"

type Props = { diff: Accessor<GitDiff | undefined>; orientation: Accessor<"auto" | "horizontal" | "vertical">; stackBelow: Accessor<number> }

type Side = "previous" | "current"

const colors = {
  previous: { text: "#ef7b7b", row: "#302025", fragment: "#65313b" },
  current: { text: "#70d6a7", row: "#193128", fragment: "#245c43" },
}

function marker(row: DiffRow, side: Side): string {
  if (side === "previous" && (row.kind === "removed" || row.kind === "modified")) return "-"
  if (side === "current" && (row.kind === "added" || row.kind === "modified")) return "+"
  return " "
}

function DiffLine(props: { cell: DiffCell | undefined; row: DiffRow; side: Side }) {
  const cell = props.cell
  const row = props.row
  const side = props.side
  const palette = colors[side]
  const number = cell ? String(cell.number).padStart(4, " ") : "    "
  return <text>
    <span ref={(value) => { value.fg = cell ? "#60717f" : "#3d4851" }}>{number}</span>
    <span ref={(value) => { value.fg = marker(row, side) === " " ? "#3d4851" : palette.text }}>{` ${marker(row, side)} `}</span>
    <For each={cell?.segments ?? []}>{(segment) => <span ref={(value) => { value.fg = row.kind === "unchanged" ? "#d6e5dc" : palette.text; value.bg = segment.changed ? palette.fragment : undefined }}>{segment.text}</span>}</For>
  </text>
}

function DiffOverview(props: { rows: DiffRow[]; side: Side }) {
  const palette = colors[props.side]
  return <box style={{ position: "relative", width: 1, flexShrink: 0, overflow: "hidden", backgroundColor: "#151a20" }}>
    <For each={diffOverviewMarkers(props.rows, props.side)}>{(marker) => <box style={{ position: "absolute", top: `${marker.start * 100}%`, width: 1, height: `${marker.size * 100}%`, minHeight: 1, backgroundColor: palette.text }} />}</For>
  </box>
}

function VersionPane(props: { title: string; rows: DiffRow[]; side: Side; scroll: (value: ScrollBoxRenderable) => void }) {
  const palette = colors[props.side]
  return <box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0, flexDirection: "column", border: true, borderColor: "#30404d" }}>
    <box style={{ height: 1, flexShrink: 0, paddingX: 1, backgroundColor: "#151c23" }}><text fg={palette.text}>{props.title}</text></box>
    <box style={{ flexGrow: 1, minHeight: 0, minWidth: 0, flexDirection: "row" }}>
      <scrollbox ref={props.scroll} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, minWidth: 0, paddingX: 1 }}>
        <For each={props.rows}>{(row) => {
          const cell = row[props.side]
          const changed = props.side === "previous" ? row.kind === "removed" || row.kind === "modified" : row.kind === "added" || row.kind === "modified"
          return <box style={{ height: 1, overflow: "hidden", backgroundColor: changed ? palette.row : cell ? undefined : "#151a20" }}><DiffLine cell={cell} row={row} side={props.side} /></box>
        }}</For>
      </scrollbox>
      <DiffOverview rows={props.rows} side={props.side} />
    </box>
  </box>
}

export function DiffPane(props: Props) {
  const renderer = useRenderer()
  const [vertical, setVertical] = createSignal(props.orientation() === "vertical" || props.orientation() === "auto" && renderer.width < props.stackBelow())
  let previousScroll: ScrollBoxRenderable | undefined
  let currentScroll: ScrollBoxRenderable | undefined
  let previousY = 0
  let currentY = 0
  const updateLayout = (width: number) => setVertical(props.orientation() === "vertical" || props.orientation() === "auto" && width < props.stackBelow())

  function syncScroll() {
    if (!previousScroll || !currentScroll) return
    if (previousScroll.scrollTop !== previousY) {
      previousY = previousScroll.scrollTop
      currentScroll.scrollTo({ x: 0, y: previousY })
      currentY = currentScroll.scrollTop
      return
    }
    if (currentScroll.scrollTop !== currentY) {
      currentY = currentScroll.scrollTop
      previousScroll.scrollTo({ x: 0, y: currentY })
      previousY = previousScroll.scrollTop
    }
  }

  onMount(() => { renderer.on("resize", updateLayout); renderer.on("frame", syncScroll) })
  onCleanup(() => { renderer.off("resize", updateLayout); renderer.off("frame", syncScroll) })
  createEffect(() => { props.orientation(); props.stackBelow(); updateLayout(renderer.width) })

  const diffRows = createMemo(() => alignDiff(props.diff()!.previous, props.diff()!.current))
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: vertical() ? "column" : "row" }}>
      <VersionPane title={t("app.previous")} rows={diffRows()} side="previous" scroll={(value) => { previousScroll = value; previousY = value.scrollTop }} />
      <VersionPane title={t("app.new")} rows={diffRows()} side="current" scroll={(value) => { currentScroll = value; currentY = value.scrollTop }} />
    </box>
  </box>
}
