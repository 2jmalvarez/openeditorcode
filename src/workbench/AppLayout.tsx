/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { DocumentTabs } from "../documents/DocumentTabs"
import { Overlays } from "../dialogs/Overlays"
import { EditorPane } from "../editor/EditorPane"
import { ExplorerPane } from "../explorer/ExplorerPane"
import type { useWorkbench } from "./useWorkbench"

type Props = ReturnType<typeof useWorkbench>

export function AppLayout(props: Props) {
  return <box style={{ flexDirection: "column", height: "100%", backgroundColor: "#101419" }}>
    <box style={{ height: 2, paddingX: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#17202a" }}>
      <box style={{ flexDirection: "column" }}><text fg="#70d6a7"><strong>{props.rootName()}</strong></text><text fg="#71808b">{props.rootParent()}</text></box>
      <text style={{ marginLeft: "auto" }} fg="#d6e5dc"><strong>OEC</strong></text>
    </box>
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
      <Show when={props.explorerVisible()} fallback={<box />}>
        <ExplorerPane root={props.root} active={() => props.active() === "explorer"} tree={props.explorer.tree} selected={props.explorer.selected} filePath={props.documents.filePath} lineCounts={props.search.lineCounts} setScroll={props.setExplorerScroll} />
      </Show>
      <box style={{ flexGrow: 1, minWidth: 0, flexDirection: "column" }}>
        <DocumentTabs tabs={props.documents.tabs} activeTab={props.documents.activeTab} dirty={props.documents.dirty} />
        <box style={{ height: 2, paddingX: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#151c23" }}>
          <text fg="#f2c66d">{props.title()}</text>
          <Show when={props.editor.findOpen()}>
            <input focused value={props.editor.findQuery()} onInput={props.editor.updateFindQuery} placeholder="Buscar..." style={{ width: 30, marginLeft: "auto", backgroundColor: "#101419" }} />
          </Show>
        </box>
        <EditorPane filePath={props.documents.filePath} content={props.editor.content} active={props.active} wrapMode={props.editor.wrapMode} lineLabels={props.editor.metrics.lineLabels} scrollbar={props.editor.metrics.scrollbar} setEditor={props.editor.setEditor} setLineNumberScroll={props.editor.metrics.setLineNumberScroll} onContentChange={props.editor.onContentChange} onCursorChange={props.editor.onCursorChange} />
      </box>
    </box>
    <box style={{ height: 3, paddingX: 1, flexDirection: "column", backgroundColor: "#17202a" }}>
      <text fg="#8ca0ae">{props.status()}</text>
      <text fg="#8ca0ae">Ln {props.editor.cursor().line}:{props.editor.cursor().column} | P menú | B archivos | F buscar | Alt+F global | Shift+Tab pestañas</text>
    </box>
    <Overlays root={props.root} overlay={props.overlays.overlay} query={props.search.query} setQuery={(value) => props.search.updateQuery(value, props.overlays.overlay() === "project-search")} newFileName={props.overlays.newFileName} setNewFileName={props.overlays.setNewFileName} newFileDirectory={props.explorer.newFileDirectory} searchIndex={props.search.searchIndex} paletteResults={props.paletteResults} projectResults={props.search.projectResults} projectSearching={props.search.projectSearching} confirmChoice={props.overlays.confirmChoice} pendingDeletion={props.overlays.pendingDeletion} />
  </box>
}
