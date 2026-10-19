/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { ProjectPanels } from "./ProjectPanels"
import type { BoxRenderable, Renderable } from "@opentui/core"

export function SessionFiles(props: { controller: EditorController; sessionID: string }) {
  const revision = useRevision(props.controller)
  const focused = () => { revision(); return props.controller.filesFocused }
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
    <Show when={props.controller.accepts(props.sessionID)}>
      <ProjectPanels controller={props.controller} sessionID={props.sessionID} focused={focused}
        onFocus={focusTree} onSearchFocus={focusOther} onOtherFocus={focusOther}
        onBlur={() => props.controller.focusFiles(false)} onExit={releaseFocus} />
    </Show>
  </box>
}
