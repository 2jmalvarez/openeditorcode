/** @jsxImportSource @opentui/solid */
import { ScrollBoxRenderable, Yoga, type BoxRenderable } from "@opentui/core"
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
  const expanded = () => { revision(); return controller.options.panelHeight === "expanded" }
  const hasOpenPanel = () => (filesVisible() && filesOpen()) || (diffVisible() && diffOpen())
  const mode = () => props.editor ? "oec-editor" : undefined
  const [height, setHeight] = createSignal(20)
  const [available, setAvailable] = createSignal(3)
  const [filesChrome, setFilesChrome] = createSignal(2)
  const [diffChrome, setDiffChrome] = createSignal(2)
  const dimensions = useTerminalDimensions()
  const sidebar = () => sidebarLayout(dimensions().height, filesVisible(), diffVisible(), diffOpen(), filesOpen())
  // OpenTUI 0.5 does not clear an explicit height when it receives undefined.
  // Always supply the sidebar's actual height, including collapsed/compact views.
  const sidebarHeight = () => expanded() && hasOpenPanel() ? available()
    : Number(filesVisible()) + Number(diffVisible()) + Number(filesVisible() && diffVisible())
      + (filesVisible() && filesOpen() ? sidebar().files : 0)
      + (diffVisible() && diffOpen() ? sidebar().changes : 0)
  let container: BoxRenderable | undefined
  const measure = () => {
    if (!container || container.isDestroyed) return
    const search = container.findDescendantById("oec-files-search-controls")
    const status = container.findDescendantById("oec-diff-status")
    if (search) setFilesChrome(1 + search.height)
    if (status) setDiffChrome(1 + status.height)
    if (props.editor || !expanded()) return
    // Discover a scrolling constraint by public OpenTUI type, never host IDs or
    // fixed parent depths. Content-relative Y is invariant under outer scrolling.
    let parent = container.parent
    while (parent && !(parent instanceof ScrollBoxRenderable)) parent = parent.parent
    let rows = dimensions().height - Math.max(0, container.screenY) - 2
    if (parent instanceof ScrollBoxRenderable) {
      const scroll = parent
      const padding = typeof scroll.content.getPadding === "function"
        ? [Yoga.Edge.Bottom, Yoga.Edge.Vertical, Yoga.Edge.All].map(edge => scroll.content.getPadding(edge)).find(value => value.unit !== Yoga.Unit.Undefined)
        : undefined
      const bottom = padding?.unit === Yoga.Unit.Percent ? parent.viewport.height * padding.value / 100 : padding?.value ?? 0
      rows = parent.viewport.height - Math.max(0, container.screenY - parent.content.screenY) - bottom
    }
    setAvailable(Math.max(3, rows))
  }
  // Keep list viewports equal in whole terminal cells. Put an odd spare row in
  // the separator, rather than giving one list a longer scrollbar track.
  const gap = () => expanded() && filesOpen() && diffOpen() ? 1 + Math.max(0, height() - filesChrome() - diffChrome() - 1) % 2 : 1
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
  onMount(() => { controller.onFilesHidden = hiddenFilesFocus; controller.context.renderer.on("frame", measure) })
  onCleanup(() => { controller.context.renderer.off("frame", measure); if (controller.onFilesHidden === hiddenFilesFocus) controller.onFilesHidden = undefined })
  return <Show when={filesVisible() || diffVisible()}><box id="oec-project-panels" ref={(value) => { container = value }}
    width={props.editor ? controller.options.explorerWidth : "100%"} height={props.editor ? "100%" : sidebarHeight()}
    minWidth={0} minHeight={0} flexShrink={0} flexDirection="column" overflow="hidden"
    onSizeChange={() => { if (container) setHeight(container.height) }}>
    <Show when={filesVisible()}><box id="oec-files-section" flexDirection="column" minHeight={0}
      flexGrow={(props.editor || expanded()) && filesOpen() ? 1 : 0} flexShrink={(props.editor || expanded()) && filesOpen() ? 1 : 0} flexBasis={filesOpen() ? expanded() ? filesChrome() : props.editor ? 0 : "auto" : "auto"}>
    <FilesToggle context={controller.context} label={`${filesOpen() ? "▾" : "▸"} Files`} keyboardMode={mode()}
      enabled={enabled} toggle={toggleFiles} onFocus={props.onOtherFocus}
      onNext={() => { if (filesOpen()) focusTree(); else nextFromFiles() }} onExit={props.onExit} />
    <Show when={filesOpen()}>
      <FilesExplorer controller={controller} sessionID={props.editor ? undefined : props.sessionID} keyboardMode={mode()}
        height={props.editor || expanded() ? undefined : sidebar().files} focused={props.focused} onFocus={props.onFocus} onBlur={props.onBlur}
        onSearchFocus={props.onSearchFocus} onNext={nextFromFiles} onExit={props.onExit} />
    </Show>
    </box></Show>
    <Show when={diffVisible()}>
      <Show when={filesVisible()}><box id="oec-panels-gap" height={gap()} flexShrink={0} /></Show>
      <box id="oec-diff-section" flexDirection="column" minHeight={0} flexGrow={expanded() && diffOpen() ? 1 : 0}
        flexShrink={expanded() && diffOpen() ? 1 : 0} flexBasis={expanded() && diffOpen() ? diffChrome() : "auto"}>
      <FilesToggle context={controller.context} id="oec-diff-toggle" label={`${diffOpen() ? "▾" : "▸"} Diff`} keyboardMode={mode()}
        enabled={enabled} toggle={() => { props.onOtherFocus(); controller.toggleDiffExpanded(); focus("oec-diff-toggle") }}
        onFocus={props.onOtherFocus} onNext={() => { if (diffOpen()) focusDiff(); else props.onExit() }} onExit={focusTree} />
      <Show when={diffOpen()}>
        <ChangesPane controller={controller} sessionID={props.sessionID ?? controller.sessionID} keyboardMode={mode()}
          fill={expanded()}
          height={props.editor ? Math.max(2, Math.min(8, Math.floor(height() / 3))) : sidebar().changes}
          onFocus={props.onOtherFocus} focusTree={focusTree} releaseFocus={props.onExit} />
      </Show>
      </box>
    </Show>
  </box></Show>
}
