/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createSignal, For, onCleanup, onMount, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import type { GitDiff } from "./status"

type Props = { diff: Accessor<GitDiff | undefined> }
type DiffLine = { number: number; text: string; changed: boolean }

function lines(content: string): string[] { return content ? content.replace(/\n$/, "").split("\n") : [] }

export function alignDiff(previous: string, current: string): [DiffLine[], DiffLine[]] {
  const left = lines(previous)
  const right = lines(current)
  let prefix = 0
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1
  let suffix = 0
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix += 1
  const mark = (values: string[], start: number, end: number) => values.map((text, index) => ({ number: index + 1, text, changed: index >= start && index < end }))
  return [mark(left, prefix, left.length - suffix), mark(right, prefix, right.length - suffix)]
}

function VersionPane(props: { title: string; lines: DiffLine[]; color: string; scroll: (value: ScrollBoxRenderable) => void }) {
  return <box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0, flexDirection: "column", border: true, borderColor: "#30404d" }}>
    <box style={{ height: 1, flexShrink: 0, paddingX: 1, backgroundColor: "#151c23" }}><text fg={props.color}>{props.title}</text></box>
    <scrollbox ref={props.scroll} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, paddingX: 1 }}>
      <For each={props.lines}>{(line) => <box style={{ backgroundColor: line.changed ? props.color === "#ef7b7b" ? "#302025" : "#193128" : undefined }}><text fg={line.changed ? props.color : "#d6e5dc"}>{String(line.number).padStart(4, " ")}  {line.text}</text></box>}</For>
    </scrollbox>
  </box>
}

export function DiffPane(props: Props) {
  const renderer = useRenderer()
  const [vertical, setVertical] = createSignal(renderer.width < 120)
  let previousScroll: ScrollBoxRenderable | undefined
  let currentScroll: ScrollBoxRenderable | undefined
  let previousY = 0
  let currentY = 0
  const updateLayout = (width: number) => setVertical(width < 120)

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

  const diffLines = () => alignDiff(props.diff()!.previous, props.diff()!.current)
  return <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "column", backgroundColor: "#101419" }}>
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: vertical() ? "column" : "row" }}>
      <VersionPane title="ANTERIOR" lines={diffLines()[0]} color="#ef7b7b" scroll={(value) => { previousScroll = value; previousY = value.scrollTop }} />
      <VersionPane title="NUEVO" lines={diffLines()[1]} color="#70d6a7" scroll={(value) => { currentScroll = value; currentY = value.scrollTop }} />
    </box>
  </box>
}
