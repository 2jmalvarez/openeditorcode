/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import { createSignal, Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { ChangesPane } from "../changes/ChangesPane"
import { FilesExplorer } from "./FilesExplorer"
import { FilesToggle } from "./FilesToggle"

/** One bounded layout for both routes: each accordion owns its own viewport. */
export function ProjectPanels(props: {
  controller: EditorController; editor?: boolean; sessionID?: string
  focused: () => boolean; onFocus: () => void; onSearchFocus: () => void
  onOtherFocus: () => void; onBlur?: () => void; onExit: () => void
}) {
  const { controller } = props
  const revision = useRevision(controller)
  const filesOpen = () => { revision(); return props.editor ? controller.editorFilesVisible : controller.filesVisible }
  const diffVisible = () => { revision(); return controller.diffVisible }
  const diffOpen = () => { revision(); return controller.diffExpanded }
  const enabled = () => { revision(); return !controller.modal }
  const mode = () => props.editor ? "oec-editor" : undefined
  const [height, setHeight] = createSignal(20)
  let container: BoxRenderable | undefined
  const focus = (id: string) => container?.findDescendantById(id)?.focus()
  const focusTree = () => { props.onFocus(); focus(filesOpen() ? "oec-files-pane" : "oec-files-toggle") }
  const focusDiff = () => { props.onOtherFocus(); focus(diffOpen() ? "oec-changes-pane" : "oec-diff-toggle") }
  const nextFromFiles = () => { if (diffVisible()) focusDiff(); else props.onExit() }
  const toggleFiles = () => {
    props.onOtherFocus()
    void controller.run(async () => {
      if (props.editor) await controller.toggleEditorFiles()
      else await controller.toggleFiles()
      // Keep keyboard control on the header when its former child unmounts.
      focus("oec-files-toggle")
    })
  }
  return <box id="oec-project-panels" ref={(value) => { container = value }}
    width={props.editor ? controller.options.explorerWidth : "100%"} height={props.editor ? "100%" : undefined}
    minWidth={0} minHeight={0} flexShrink={0} flexDirection="column" overflow="hidden"
    onSizeChange={() => { if (container) setHeight(container.height) }}>
    <FilesToggle context={controller.context} label={`${filesOpen() ? "▾" : "▸"} Files`} keyboardMode={mode()}
      enabled={enabled} toggle={toggleFiles} onFocus={props.onOtherFocus}
      onNext={() => { if (filesOpen()) focusTree(); else nextFromFiles() }} onExit={props.onExit} />
    <Show when={filesOpen()}>
      <FilesExplorer controller={controller} sessionID={props.editor ? undefined : props.sessionID} keyboardMode={mode()}
        height={props.editor ? undefined : 15} focused={props.focused} onFocus={props.onFocus} onBlur={props.onBlur}
        onSearchFocus={props.onSearchFocus} onNext={nextFromFiles} onExit={props.onExit} />
    </Show>
    <Show when={diffVisible()}>
      <FilesToggle context={controller.context} id="oec-diff-toggle" label={`${diffOpen() ? "▾" : "▸"} Diff`} keyboardMode={mode()}
        enabled={enabled} toggle={() => { props.onOtherFocus(); controller.toggleDiffExpanded(); focus("oec-diff-toggle") }}
        onFocus={props.onOtherFocus} onNext={() => { if (diffOpen()) focusDiff(); else props.onExit() }} onExit={focusTree} />
      <Show when={diffOpen()}>
        <ChangesPane controller={controller} sessionID={props.sessionID ?? controller.sessionID} keyboardMode={mode()}
          height={props.editor ? Math.max(2, Math.min(8, Math.floor(height() / 3))) : 8}
          onFocus={props.onOtherFocus} focusTree={focusTree} releaseFocus={props.onExit} />
      </Show>
    </Show>
  </box>
}
