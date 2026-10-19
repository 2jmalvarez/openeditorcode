/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount } from "solid-js"
import { virtualRange, scrollTopForSelected } from "../../../../src/explorer/virtual-rows"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"

export function FilesPane(props: { controller: EditorController; focused: () => boolean; onFocus: () => void; sessionID?: string; width?: number; height?: number; keyboardMode?: string }) {
  const { controller } = props
  const treeRevision = useRevision(controller.tree)
  const controllerRevision = useRevision(controller)
  const tree = () => { treeRevision(); return controller.tree }
  let scroll: ScrollBoxRenderable | undefined
  let panel: BoxRenderable | undefined
  const [range, setRange] = createSignal(virtualRange(tree().items.length, tree().scrollTop, props.height ?? 20))
  const rows = createMemo(() => { treeRevision(); return tree().items.slice(range().start, range().end) })
  const activate = async (index = tree().selected) => {
    props.onFocus()
    tree().select(index)
    const item = tree().items[index]
    if (item?.directory) await tree().toggle(index)
    else if (item) await controller.open(item.path, props.sessionID)
  }
  controller.context.keymap.layer(() => {
    controllerRevision()
    return { mode: props.keyboardMode, target: () => panel, enabled: props.focused() && !controller.modal, priority: 30, commands: [
      { bind: "up", run: () => tree().move(-1) }, { bind: "down", run: () => tree().move(1) },
      { bind: "return", run: () => controller.run(() => activate()) },
      { bind: "right", run: () => controller.run(() => activate()) },
      { bind: "left", run: () => controller.run(() => tree().collapse()) },
      { bind: "f5", run: () => controller.run(() => tree().refresh()) },
      { bind: "escape", run: () => controller.focusFiles(false) },
    ] }
  })
  const measure = () => {
    if (!scroll) return
    // Host confirmation restores the prompt after resolving its promise. Recover
    // desired tree focus only in the input mode that requested it, not in modals.
    const mode = props.keyboardMode ?? controller.filesInputMode
    if (mode !== undefined && props.focused() && !controller.modal && controller.context.keymap.mode.current() === mode && panel && !panel.isDestroyed && !panel.focused) panel.focus()
    tree().scrollTop = scroll.scrollTop
    const next = virtualRange(tree().items.length, scroll.scrollTop, scroll.viewport.height || props.height || 20)
    const current = range()
    if (current.start !== next.start || current.end !== next.end || current.bottom !== next.bottom) setRange(next)
  }
  createEffect(() => {
    controllerRevision()
    if (props.focused() && !controller.modal) panel?.focus()
    else panel?.blur()
  })
  createEffect(() => {
    treeRevision()
    if (scroll) scroll.scrollTop = scrollTopForSelected(tree().items.length, tree().selected, scroll.scrollTop, scroll.viewport.height || 20)
    measure()
  })
  onMount(() => { controller.context.renderer.on("frame", measure); void controller.run(() => tree().refresh()) })
  onCleanup(() => { measure(); controller.context.renderer.off("frame", measure) })
  return <box id="oec-files-pane" ref={(value) => { panel = value }} focusable focused={props.focused() && !controller.modal}
    width={props.width ?? "100%"} height={props.height ?? "100%"} minHeight={0} flexShrink={0} flexDirection="column"
    border={["left"]} borderColor={controller.context.theme.text.muted} onMouseDown={props.onFocus}>
    <text fg={controller.context.theme.text.base}> FILES · ↑↓ Enter</text>
    <scrollbox ref={(value) => { scroll = value; value.scrollTop = tree().scrollTop; measure() }} flexGrow={1} minHeight={0} scrollY>
      <box height={range().top} flexShrink={0} />
      <For each={rows()}>{(item, index) => {
        const logicalIndex = () => range().start + index()
        return <box id={`oec-tree-${logicalIndex()}`} height={1} flexShrink={0} paddingLeft={item.depth + 1}
          backgroundColor={logicalIndex() === tree().selected ? controller.context.theme.background.raised.base : undefined}
          onMouseDown={(event) => { event.stopPropagation(); void controller.run(() => activate(logicalIndex())) }}>
          <text fg={item.ignored ? controller.context.theme.text.muted : controller.context.theme.text.base}>
            {item.directory ? item.expanded ? "▾ " : "▸ " : "  "}{item.name}
          </text>
        </box>
      }}</For>
      <box height={range().bottom} flexShrink={0} />
    </scrollbox>
  </box>
}
