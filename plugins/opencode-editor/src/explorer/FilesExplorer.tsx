/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import type { EditorController } from "../integration/controller"
import { FileSearchPane } from "./FileSearchPane"
import { FilesPane } from "./FilesPane"

/** Both the editor route and conversation render the very same searchable tree. */
export function FilesExplorer(props: {
  controller: EditorController; sessionID?: string; keyboardMode?: string
  width?: number; height?: number; focused: () => boolean
  onFocus: () => void; onSearchFocus: () => void; onBlur?: () => void
  onExit: () => void; onNext?: () => void
}) {
  let container: BoxRenderable | undefined
  const focusSearch = () => { props.onSearchFocus(); container?.findDescendantById("oec-files-search")?.focus() }
  const focusTree = () => { props.onFocus(); container?.findDescendantById("oec-files-pane")?.focus() }
  return <box ref={(value) => { container = value }} width={props.width ?? "100%"} height={props.height}
    flexGrow={props.height === undefined ? 1 : 0} flexBasis={props.height === undefined ? 0 : undefined}
    minHeight={0} minWidth={0} flexShrink={props.height === undefined ? 1 : 0}
    flexDirection="column" overflow="hidden">
    <FileSearchPane controller={props.controller} sessionID={props.sessionID} keyboardMode={props.keyboardMode}
      onFocus={props.onSearchFocus} focusTree={focusTree} releaseFocus={props.onExit} />
    <FilesPane controller={props.controller} sessionID={props.sessionID} keyboardMode={props.keyboardMode}
      focused={props.focused} onFocus={props.onFocus} onBlur={props.onBlur} onExit={props.onExit}
      onSearch={focusSearch} onNext={props.onNext ?? focusSearch} />
  </box>
}
