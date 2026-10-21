/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { DocumentTabs } from "../documents/DocumentTabs"
import { Overlays } from "../dialogs/Overlays"
import { EditorPane } from "../editor/EditorPane"
import { FindPanel } from "../editor/FindPanel"
import { ExplorerPane } from "../explorer/ExplorerPane"
import { DiffPane } from "../git/DiffPane"
import { GitPane } from "../git/GitPane"
import { MarkdownPreview } from "../documents/MarkdownPreview"
import { ImagePreview } from "../documents/ImagePreview"
import { SvgPreview } from "../documents/SvgPreview"
import { LogPane } from "../logs/LogPane"
import type { useWorkbench } from "./useWorkbench"
import { t } from "../localization"

type Props = ReturnType<typeof useWorkbench>

export function AppLayout(props: Props) {
  const terminal = useTerminalDimensions()
  const footerMessage = () => (props.activity.busy() ? `${props.activity.spinner()} ${props.activity.message()}` : props.logs.notice() || props.status())
    + (props.documents.activePreview() && props.documents.canTogglePreview() ? t("app.f4Edit") : "")
    + (props.documents.activeDiff() ? t("app.f4Open") : "")
  const footerDetails = () => (props.config().keyboard.profile === "vim" && props.documents.activeProjectFile() ? `${props.editor.vimMode().toUpperCase()}  |  ` : "")
    + (props.documents.filePath() && !props.documents.activePreview() ? `${t("app.line")} ${props.editor.cursor().line}:${props.editor.cursor().column}  |  ` : "")
    + `v${props.appVersion}` + (props.updates.latestVersion() ? ` ↑ ${props.updates.latestVersion()}` : "")
  const showSearchHelp = () => props.active() === "explorer" && !props.overlays.overlay()
    && Bun.stringWidth(footerMessage()) + Bun.stringWidth(footerDetails()) + Bun.stringWidth(t("app.explorerSearchHelp")) + 4 <= terminal().width - 2
  return <box style={{ flexDirection: "column", height: "100%", backgroundColor: "#101419" }}>
    <box style={{ height: 1, paddingX: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#17202a" }}>
      <text fg="#70d6a7"><strong>{props.rootName()}</strong></text>
      <Show when={props.recovery}><text style={{ marginLeft: 1 }} fg="#f2c66d">{t("config.restored")}</text></Show>
      <text style={{ marginLeft: "auto" }} fg="#71808b">{props.root}</text>
    </box>
    <box style={{ flexGrow: 1, minHeight: 0, flexDirection: "row" }}>
      <Show when={props.explorerVisible()} fallback={<box />}>
        <ExplorerPane root={props.root} active={() => props.active() === "explorer" && !props.overlays.overlay()} tree={props.explorer.tree} selected={props.explorer.selected} filePath={props.documents.filePath} lineCounts={props.search.lineCounts} setScroll={props.setExplorerScroll} onActivate={props.activateExplorerAt} fileSearchMode={props.search.fileSearchMode} fileSearching={props.search.fileSearching} fileQuery={props.search.fileQuery} fileResults={props.search.fileResults} onFileQuery={(value) => void props.search.updateFileQuery(value)} massiveFilesOpen={props.explorer.showMassiveFiles} onToggleMassiveFiles={props.toggleMassiveFiles} width={() => props.config().layout.explorerWidth} />
      </Show>
        <box style={{ flexGrow: 1, minWidth: 0, flexDirection: "column", border: ["top"], borderColor: props.active() === "editor" ? "#70d6a7" : "#30404d" }}>
        <DocumentTabs tabs={props.documents.tabs} activeTab={props.documents.activeTab} isTabDirty={props.documents.isTabDirty} onActivate={props.documents.activateTab} onClose={props.requestCloseTab} />
        <box style={{ position: "relative", flexGrow: 1, minHeight: 0 }}>
          <Show
            when={props.documents.activeDiff()}
            fallback={<Show
              when={props.documents.activeLogs()}
              fallback={<Show
                when={props.documents.activeManual() || props.documents.activePreview()}
                fallback={<><EditorPane filePath={props.documents.filePath} content={props.editor.content} active={props.active} explorerVisible={props.explorerVisible} gitVisible={props.gitVisible} wrapMode={props.editor.wrapMode} lineLabels={props.editor.metrics.lineLabels} scrollbar={props.editor.metrics.scrollbar} setEditor={props.editor.setEditor} onContentChange={props.editor.onContentChange} onCursorChange={props.editor.onCursorChange} onUnmount={props.editor.detachEditor} config={props.config} syntaxTheme={props.syntaxTheme} /><FindPanel open={props.editor.findOpen} query={props.editor.findQuery} results={props.editor.findResults} index={props.editor.findIndex} onQuery={props.editor.updateFindQuery} maxWidth={() => props.config().layout.findPanelMaxWidth} /></>}
              >
                 <Show when={props.documents.activeImage()} fallback={<Show when={props.documents.activeSvg()} fallback={<MarkdownPreview content={props.documents.activePreviewContent} active={() => props.active() === "editor"} manual={() => Boolean(props.documents.activeManual())} />}>
                   <SvgPreview content={props.documents.activePreviewContent} active={() => props.active() === "editor"} protocol={() => props.config().preview.imageProtocol} />
                 </Show>}>
                  <ImagePreview bytes={() => props.documents.activeImage()?.bytes} active={() => props.active() === "editor"} protocol={() => props.config().preview.imageProtocol} />
                </Show>
              </Show>}
            >
              <LogPane entries={props.logs.entries} active={() => props.active() === "editor"} setViewer={props.setLogViewer} />
            </Show>}
          >
            <DiffPane diff={props.documents.activeDiff} orientation={() => props.config().layout.diffOrientation} stackBelow={() => props.config().layout.diffStackBelow} />
          </Show>
        </box>
        </box>
      <Show when={props.gitVisible()}>
        <GitPane active={() => props.active() === "git"} state={props.git.state} tree={props.git.tree} selected={props.git.selected} commitMessage={props.git.commitMessage} setCommitMessage={props.git.setCommitMessage} commitFocused={props.git.commitFocused} setScroll={props.setGitScroll} onActivate={props.activateGitAt} width={() => props.config().layout.changesWidth} mode={props.git.mode} historyTitle={props.git.historyTitle} loading={props.git.loading} showCommitHashes={props.git.showCommitHashes} showCommitDates={props.git.showCommitDates} />
      </Show>
    </box>
    <box style={{ height: 1, paddingX: 1, flexDirection: "column", backgroundColor: "#17202a" }}>
      <box style={{ flexDirection: "row" }}>
        <text fg="#8ca0ae">{footerMessage()}</text>
        <Show when={showSearchHelp()}><text style={{ marginLeft: 2 }} fg="#71808b">{t("app.explorerSearchHelp")}</text></Show>
        <text style={{ marginLeft: "auto" }} fg="#8ca0ae">{footerDetails()}</text>
      </box>
    </box>
    <Overlays root={props.root} overlay={props.overlays.overlay} query={props.search.query} setQuery={(value) => props.search.updateQuery(value, props.overlays.overlay() === "project-search")} newFileName={props.overlays.newFileName} setNewFileName={props.overlays.setNewFileName} newFileDirectory={props.overlays.newFileDirectory} renameName={props.overlays.renameName} setRenameName={props.overlays.setRenameName} searchIndex={props.search.searchIndex} paletteResults={props.paletteResults} projectResults={props.search.projectResults} projectSearching={props.search.projectSearching} confirmChoice={props.overlays.confirmChoice} pendingDeletion={props.overlays.pendingDeletion} pendingRename={props.overlays.pendingRename} pendingAction={props.overlays.pendingAction} pendingGitRevert={props.overlays.pendingGitRevert} pendingExternalChange={props.overlays.pendingExternalChange} exclusionQuery={props.search.exclusionQuery} setExclusionQuery={props.search.updateExclusionQuery} exclusionIndex={props.search.exclusionIndex} exclusionSuggestions={props.search.exclusionSuggestions} settingsIndex={props.overlays.settingsIndex} settingsScope={props.overlays.settingsScope} settingsValues={props.settingsValues} />
  </box>
}
