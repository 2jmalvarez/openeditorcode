/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { For, Show, type Accessor } from "solid-js"
import { displayPath, type TreeItem } from "./tree"

type Props = {
  root: string
  active: Accessor<boolean>
  tree: Accessor<TreeItem[]>
  selected: Accessor<number>
  filePath: Accessor<string | undefined>
  lineCounts: Accessor<Record<string, number>>
  setScroll: (scroll: ScrollBoxRenderable) => void
  onActivate: (index: number) => void
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
  return <box style={{ width: 32, flexShrink: 0, flexDirection: "column", border: ["right"], borderColor: "#30404d" }}>
    <box style={{ paddingX: 1, paddingY: 1 }}>
      <text fg={props.active() ? "#70d6a7" : "#8ca0ae"}>ARCHIVOS</text>
    </box>
    <scrollbox ref={props.setScroll} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1 }}>
      <For each={props.tree()}>{(item, itemIndex) => (
        <box id={`tree-${itemIndex()}`} onMouseDown={() => props.onActivate(itemIndex())} style={{ paddingLeft: item.depth + 1, flexDirection: "row", alignItems: "center", backgroundColor: itemIndex() === props.selected() ? "#28404a" : undefined }}>
          <text fg={item.ignored ? "#59646d" : item.directory ? "#8ed1ff" : item.path === props.filePath() ? "#f2c66d" : "#d6e5dc"}>{fileIcon(item)} {item.name}</text>
          <Show when={!item.directory && props.lineCounts()[item.path] !== undefined} fallback={<box />}>
            <text style={{ marginLeft: "auto" }} fg="#71808b">{props.lineCounts()[item.path]}</text>
          </Show>
        </box>
      )}</For>
    </scrollbox>
  </box>
}
