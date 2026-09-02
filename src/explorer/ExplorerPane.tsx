/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { displayPath, type TreeItem } from "./tree"
import { virtualRange } from "./virtual-rows"
import { relativeResult, type IndexedItem } from "../search/file-index"
import { t } from "../localization"

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
  width: Accessor<number>
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

  return <box style={{ width: props.width(), flexShrink: 0, minHeight: 0, overflow: "hidden", flexDirection: "column", border: ["right"], borderColor: "#30404d" }}>
    <box style={{ flexShrink: 0, paddingX: 1, paddingTop: 1 }}><text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>{t("app.explorer")}</text></box>
    <Show when={props.fileSearchOpen()}>
      <box style={{ paddingX: 1, flexDirection: "column" }}>
        <input focused={props.active()} value={props.fileQuery()} onInput={props.onFileQuery} placeholder={t("app.searchFile")} style={{ backgroundColor: "#17202a" }} />
        <text fg="#71808b">{t("app.results", { count: props.fileResults().length })} | Ctrl+E</text>
      </box>
    </Show>
    <scrollbox ref={(value) => { scroll = value; props.setScroll(value); syncRange() }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, paddingX: 1 }}>
      <Show when={props.fileSearchOpen()} fallback={<>
        <Show when={range().top}><box style={{ height: range().top }} /></Show>
        <For each={rows()}>{(item, itemIndex) => { const logicalIndex = () => range().start + itemIndex(); return (
          <box id={`tree-${logicalIndex()}`} onMouseDown={() => props.onActivate(logicalIndex())} style={{ height: 1, flexShrink: 0, paddingLeft: item.depth, overflow: "hidden", flexDirection: "row", alignItems: "center", backgroundColor: logicalIndex() === props.selected() ? "#28404a" : undefined }}>
            <box style={{ flexGrow: 1, minWidth: 0, height: 1, overflow: "hidden" }}><text fg={item.ignored ? "#59646d" : item.directory ? "#8ed1ff" : item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>{fileIcon(item)} {item.name}</text></box>
            <Show when={!item.directory && props.lineCounts()[item.path] !== undefined} fallback={<box />}>
              <text style={{ marginLeft: "auto" }} fg="#71808b">{props.lineCounts()[item.path]}</text>
            </Show>
          </box>
        )}}</For>
        <Show when={range().bottom}><box style={{ height: range().bottom }} /></Show>
      </>}>
        <For each={props.fileResults()}>{(item, index) => (
          <box id={`file-search-${index()}`} onMouseDown={() => props.onFileActivate(index())} style={{ height: 1, flexShrink: 0, overflow: "hidden", flexDirection: "row", backgroundColor: index() === props.fileSearchIndex() ? "#28404a" : undefined }}>
            <text fg={item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>📄 {relativeResult(props.root, item)}</text>
          </box>
        )}</For>
      </Show>
    </scrollbox>
  </box>
}
