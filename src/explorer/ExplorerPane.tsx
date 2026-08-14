/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { displayPath, type TreeItem } from "./tree"
import { virtualRange } from "./virtual-rows"
import { relativeResult, type IndexedItem } from "../search/file-index"

type Props = {
  root: string
  active: Accessor<boolean>
  tree: Accessor<TreeItem[]>
  selected: Accessor<number>
  filePath: Accessor<string | undefined>
  lineCounts: Accessor<Record<string, number>>
  setScroll: (scroll: ScrollBoxRenderable) => void
  onActivate: (index: number) => void
  fileSearchOpen: Accessor<boolean>
  fileQuery: Accessor<string>
  fileResults: Accessor<IndexedItem[]>
  fileSearchIndex: Accessor<number>
  onFileQuery: (value: string) => void
  onFileActivate: (index: number) => void
}

function fileIcon(item: TreeItem): string {
  if (item.directory) return item.expanded ? "📂" : "📁"
  const extension = item.name.slice(item.name.lastIndexOf(".")).toLocaleLowerCase()
  if ([".ts", ".tsx"].includes(extension)) return "🔷"
  if ([".js", ".jsx"].includes(extension)) return "🟨"
  if ([".json", ".yml", ".yaml", ".toml"].includes(extension)) return "⚙"
  if ([".css", ".scss", ".html"].includes(extension)) return "🎨"
  if ([".md", ".txt"].includes(extension)) return "📝"
  if ([".py", ".sh", ".ps1", ".bat"].includes(extension)) return "⚡"
  return "📄"
}

export function ExplorerPane(props: Props) {
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

  return <box style={{ width: 32, flexShrink: 0, flexDirection: "column", border: ["right"], borderColor: "#30404d" }}>
    <box style={{ paddingX: 1, paddingTop: 1 }}><text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>EXPLORADOR</text></box>
    <Show when={props.fileSearchOpen()}>
      <box style={{ paddingX: 1, flexDirection: "column" }}>
        <input focused={props.active()} value={props.fileQuery()} onInput={props.onFileQuery} placeholder="Buscar archivo..." style={{ backgroundColor: "#17202a" }} />
        <text fg="#71808b">{props.fileResults().length} resultados | Ctrl+E</text>
      </box>
    </Show>
    <scrollbox ref={(value) => { scroll = value; props.setScroll(value); syncRange() }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, paddingX: 1 }}>
      <Show when={props.fileSearchOpen()} fallback={<>
        <Show when={range().top}><box style={{ height: range().top }} /></Show>
        <For each={rows()}>{(item, itemIndex) => { const logicalIndex = () => range().start + itemIndex(); return (
          <box id={`tree-${logicalIndex()}`} onMouseDown={() => props.onActivate(logicalIndex())} style={{ paddingLeft: item.depth, flexDirection: "row", alignItems: "center", backgroundColor: logicalIndex() === props.selected() ? "#28404a" : undefined }}>
            <text fg={item.ignored ? "#59646d" : item.directory ? "#8ed1ff" : item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>{fileIcon(item)} {item.name}</text>
            <Show when={!item.directory && props.lineCounts()[item.path] !== undefined} fallback={<box />}>
              <text style={{ marginLeft: "auto" }} fg="#71808b">{props.lineCounts()[item.path]}</text>
            </Show>
          </box>
        )}}</For>
        <Show when={range().bottom}><box style={{ height: range().bottom }} /></Show>
      </>}>
        <For each={props.fileResults()}>{(item, index) => (
          <box id={`file-search-${index()}`} onMouseDown={() => props.onFileActivate(index())} style={{ flexDirection: "row", backgroundColor: index() === props.fileSearchIndex() ? "#28404a" : undefined }}>
            <text fg={item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>📄 {relativeResult(props.root, item)}</text>
          </box>
        )}</For>
      </Show>
    </scrollbox>
  </box>
}
