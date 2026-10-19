/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { FilesPane } from "./FilesPane"
import { FilesToggle } from "./FilesToggle"
import { FileSearchPane } from "./FileSearchPane"
import { ChangesPane } from "../changes/ChangesPane"
import type { BoxRenderable, Renderable } from "@opentui/core"

export function SessionFiles(props: { controller: EditorController; sessionID: string }) {
  const revision = useRevision(props.controller)
  const visible = () => { revision(); return props.controller.filesVisible && props.controller.accepts(props.sessionID) }
  const focused = () => { revision(); return props.controller.filesFocused }
  const searchRevision = useRevision(props.controller.fileSearch)
  const searching = () => { searchRevision(); return Boolean(props.controller.fileSearch.query.trim()) }
  let container: BoxRenderable | undefined
  let returnFocus: Renderable | null = props.controller.context.renderer.currentFocusedRenderable
  const rememberFocus = () => {
    const current = props.controller.context.renderer.currentFocusedRenderable
    let ancestor = current
    while (ancestor) { if (ancestor === container) return; ancestor = ancestor.parent as Renderable | null }
    if (current) returnFocus = current
  }
  const focusTree = () => {
    rememberFocus()
    props.controller.focusFiles(true)
    container?.findDescendantById("oec-files-pane")?.focus()
  }
  const releaseFocus = () => {
    props.controller.focusFiles(false)
    if (returnFocus && !returnFocus.isDestroyed) returnFocus.focus()
  }
  const focusOther = () => { rememberFocus(); props.controller.focusFiles(false) }
  return <box ref={(value) => { container = value }} flexDirection="column" flexShrink={0}>
    <FilesToggle context={props.controller.context} label={`OEC · ${visible() ? "Hide files" : "Show files"}`}
      toggle={() => { rememberFocus(); void props.controller.run(async () => { await props.controller.toggleFiles(); if (!props.controller.filesVisible) releaseFocus() }) }} />
    <Show when={visible()}>
      <FileSearchPane controller={props.controller} sessionID={props.sessionID} onFocus={focusOther} focusTree={focusTree} releaseFocus={releaseFocus} />
      <Show when={!searching()}>
        <FilesPane controller={props.controller} sessionID={props.sessionID} height={12} focused={focused} onFocus={focusTree}
          onBlur={() => props.controller.focusFiles(false)} onExit={releaseFocus}
          onSearch={() => { focusOther(); container?.findDescendantById("oec-files-search")?.focus() }}
          onNext={() => { focusOther(); container?.findDescendantById("oec-changes-pane")?.focus() }} />
      </Show>
      <ChangesPane controller={props.controller} sessionID={props.sessionID} onFocus={focusOther} focusTree={() => { void props.controller.fileSearch.search(""); focusTree() }} releaseFocus={releaseFocus} />
    </Show>
  </box>
}
