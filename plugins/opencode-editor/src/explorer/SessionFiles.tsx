/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { FilesPane } from "./FilesPane"

export function SessionFiles(props: { controller: EditorController; sessionID: string }) {
  const revision = useRevision(props.controller)
  const visible = () => { revision(); return props.controller.filesVisible && props.controller.accepts(props.sessionID) }
  const focused = () => { revision(); return props.controller.filesFocused }
  return <box flexDirection="column" flexShrink={0}>
    <text fg={props.controller.context.theme.text.base} onMouseDown={() => void props.controller.run(() => props.controller.toggleFiles())}>
      OEC · {visible() ? "Hide files" : "Show files"}
    </text>
    <Show when={visible()}>
      <FilesPane controller={props.controller} sessionID={props.sessionID} height={16} focused={focused} onFocus={() => props.controller.focusFiles(true)} />
    </Show>
  </box>
}
