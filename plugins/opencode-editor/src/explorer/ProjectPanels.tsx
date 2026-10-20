/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { ChangesPane } from "../changes/ChangesPane"
import { FilesExplorer } from "./FilesExplorer"
import { FilesToggle } from "./FilesToggle"
import { sidebarLayout } from "./sidebar-layout"

/** One bounded layout for both routes: each accordion owns its own viewport. */
export function ProjectPanels(props: {
  controller: EditorController; editor?: boolean; sessionID?: string
  focused: () => boolean; onFocus: () => void; onSearchFocus: () => void
  onOtherFocus: () => void; onBlur?: () => void; onExit: () => void
}) {
  const { controller } = props
  const revision = useRevision(controller)
  const filesVisible = () => { revision(); return props.editor ? controller.editorFilesVisible : controller.filesVisible }
  const filesOpen = () => { revision(); return controller.filesExpanded }
  const diffVisible = () => { revision(); return controller.diffVisible }
  const diffOpen = () => { revision(); return controller.diffExpanded }
  const enabled = () => { revision(); return !controller.modal }
  const mode = () => props.editor ? "oec-editor" : undefined
  const [height, setHeight] = createSignal(20)
  const dimensions = useTerminalDimensions()
  const sidebar = () => sidebarLayout(dimensions().height, filesVisible(), diffVisible(), diffOpen(), filesOpen())
  let container: BoxRenderable | undefined
  const focus = (id: string) => container?.findDescendantById(id)?.focus()
  const focusTree = () => { if (!filesVisible()) { props.onExit(); return }; props.onFocus(); focus(filesOpen() ? "oec-files-pane" : "oec-files-toggle") }
  const focusDiff = () => { props.onOtherFocus(); focus(diffOpen() ? "oec-changes-pane" : "oec-diff-toggle") }
  const nextFromFiles = () => { if (diffVisible()) focusDiff(); else props.onExit() }
  const toggleFiles = () => {
    props.onOtherFocus()
    controller.toggleFilesExpanded()
    focus("oec-files-toggle")
  }
  const hiddenFilesFocus = () => { props.onOtherFocus(); if (diffVisible()) focusDiff(); else props.onExit() }
  onMount(() => { controller.onFilesHidden = hiddenFilesFocus })
  onCleanup(() => { if (controller.onFilesHidden === hiddenFilesFocus) controller.onFilesHidden = undefined })
  return <Show when={filesVisible() || diffVisible()}><box id="oec-project-panels" ref={(value) => { container = value }}
    width={props.editor ? controller.options.explorerWidth : "100%"} height={props.editor ? "100%" : undefined}
    minWidth={0} minHeight={0} flexShrink={0} flexDirection="column" overflow="hidden"
    onSizeChange={() => { if (container) setHeight(container.height) }}>
    <Show when={filesVisible()}><box id="oec-files-section" flexDirection="column" minHeight={0}
      flexGrow={props.editor && filesOpen() ? 1 : 0} flexShrink={props.editor && filesOpen() ? 1 : 0} flexBasis={props.editor && filesOpen() ? 0 : undefined}>
    <FilesToggle context={controller.context} label={`${filesOpen() ? "▾" : "▸"} Files`} keyboardMode={mode()}
      enabled={enabled} toggle={toggleFiles} onFocus={props.onOtherFocus}
      onNext={() => { if (filesOpen()) focusTree(); else nextFromFiles() }} onExit={props.onExit} />
    <Show when={filesOpen()}>
      <FilesExplorer controller={controller} sessionID={props.editor ? undefined : props.sessionID} keyboardMode={mode()}
        height={props.editor ? undefined : sidebar().files} focused={props.focused} onFocus={props.onFocus} onBlur={props.onBlur}
        onSearchFocus={props.onSearchFocus} onNext={nextFromFiles} onExit={props.onExit} />
    </Show>
    </box></Show>
    <Show when={diffVisible()}>
      <Show when={filesVisible()}><box id="oec-panels-gap" height={1} flexShrink={0} /></Show>
      <FilesToggle context={controller.context} id="oec-diff-toggle" label={`${diffOpen() ? "▾" : "▸"} Diff`} keyboardMode={mode()}
        enabled={enabled} toggle={() => { props.onOtherFocus(); controller.toggleDiffExpanded(); focus("oec-diff-toggle") }}
        onFocus={props.onOtherFocus} onNext={() => { if (diffOpen()) focusDiff(); else props.onExit() }} onExit={focusTree} />
      <Show when={diffOpen()}>
        <ChangesPane controller={controller} sessionID={props.sessionID ?? controller.sessionID} keyboardMode={mode()}
          height={props.editor ? Math.max(2, Math.min(8, Math.floor(height() / 3))) : sidebar().changes}
          onFocus={props.onOtherFocus} focusTree={focusTree} releaseFocus={props.onExit} />
      </Show>
    </Show>
  </box></Show>
}
