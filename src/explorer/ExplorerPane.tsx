/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import { displayPath, type TreeItem } from "./tree"
import { virtualRange } from "./virtual-rows"
import type { IndexedItem } from "../search/file-index"
import { t } from "../localization"
import { ScrollingName } from "./ScrollingName"

type Props = {
  root: string
  active: Accessor<boolean>
  tree: Accessor<TreeItem[]>
  selected: Accessor<number>
  filePath: Accessor<string | undefined>
  lineCounts: Accessor<Record<string, number>>
  setScroll: (scroll: ScrollBoxRenderable) => void
  onActivate: (index: number) => void
  fileQuery: Accessor<string>
  fileSearchMode?: Accessor<"name" | "content">
  fileSearching?: Accessor<boolean>
  fileResults: Accessor<IndexedItem[]>
  onFileQuery: (value: string) => void
  massiveFilesOpen: Accessor<boolean>
  onToggleMassiveFiles: () => void
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
  const placeholder = () => t(props.fileSearchMode?.() === "content" ? "app.searchContent" : "app.searchFile")
  const searchHint = () => {
    const hint = t(props.fileSearchMode?.() === "content" ? "app.searchNameHint" : "app.searchContentHint")
    return Bun.stringWidth(placeholder()) + Bun.stringWidth(hint) + 1 <= props.width() - 3 ? hint : " Ctrl+F"
  }

  function syncRange() {
    if (!scroll) return
    const next = virtualRange(props.tree().length, scroll.scrollTop, scroll.viewport.height || scroll.height)
    const current = range()
    if (next.start !== current.start || next.end !== current.end || next.bottom !== current.bottom) setRange(next)
  }

  onMount(() => renderer.on("frame", syncRange))
  onCleanup(() => renderer.off("frame", syncRange))

  return <box style={{ width: props.width(), flexShrink: 0, minHeight: 0, overflow: "hidden", flexDirection: "column", border: ["right"], borderColor: "#30404d" }}>
    <box style={{ flexShrink: 0, paddingX: 1, paddingTop: 1 }}><text onMouseDown={props.onToggleMassiveFiles} fg={props.active() ? "#70d6a7" : "#8ca0ae"}>{props.massiveFilesOpen() ? "ARCHIVOS MASIVOS [Arbol]" : `${t("app.explorer")} [Masivos]`}</text></box>
    <box style={{ flexShrink: 0, paddingX: 1, flexDirection: "column" }}>
      <box style={{ height: 1, flexShrink: 0, flexDirection: "row", backgroundColor: "#17202a" }}>
        <input focused={props.active()} value={props.fileQuery()} onInput={props.onFileQuery} placeholder={placeholder()} style={{ width: 0, flexGrow: 1, minWidth: 1, backgroundColor: "#17202a" }} />
        <text fg="#71808b" style={{ flexShrink: 0 }}>{searchHint()}</text>
      </box>
      <Show when={props.fileQuery().trim()}><text fg="#71808b">{props.fileSearching?.() ? t("app.filterSearching") : props.fileResults().length === 1 ? t("app.resultOne") : t("app.results", { count: props.fileResults().length })} | Ctrl+E</text></Show>
    </box>
    <scrollbox ref={(value) => { scroll = value; props.setScroll(value); syncRange() }} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0, paddingX: 1 }}>
      <Show when={props.fileQuery().trim() && !props.fileSearching?.() && !props.tree().length}><text fg="#71808b">{t("search.noFiles")}</text></Show>
        <Show when={range().top}><box style={{ height: range().top }} /></Show>
        <For each={rows()}>{(item, itemIndex) => { const logicalIndex = () => range().start + itemIndex(); return (
          <box id={`tree-${logicalIndex()}`} onMouseDown={() => props.onActivate(logicalIndex())} style={{ height: 1, flexShrink: 0, paddingLeft: item.depth, overflow: "hidden", flexDirection: "row", alignItems: "center", backgroundColor: logicalIndex() === props.selected() ? "#28404a" : undefined }}>
            <box style={{ width: 0, flexGrow: 1, minWidth: 0, height: 1, overflow: "hidden", flexDirection: "row" }}>
              <text style={{ width: 3, flexShrink: 0 }} fg={item.ignored ? "#59646d" : item.directory ? "#8ed1ff" : item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>{fileIcon(item)}</text>
              <ScrollingName name={item.name} selected={() => logicalIndex() === props.selected()} active={props.active} color={item.ignored ? "#59646d" : item.directory ? "#8ed1ff" : item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"} />
            </box>
            <Show when={!item.directory && props.lineCounts()[item.path] !== undefined} fallback={<box />}>
              <text style={{ marginLeft: 1, flexShrink: 0 }} fg="#71808b">{props.lineCounts()[item.path]}</text>
            </Show>
          </box>
        )}}</For>
        <Show when={range().bottom}><box style={{ height: range().bottom }} /></Show>
    </scrollbox>
  </box>
}
