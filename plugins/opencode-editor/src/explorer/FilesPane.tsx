/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount } from "solid-js"
import { virtualRange, scrollTopForSelected } from "../../../../src/explorer/virtual-rows"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { ScrollingName } from "../../../../src/explorer/ScrollingName"

export function FilesPane(props: { controller: EditorController; focused: () => boolean; onFocus: () => void; onBlur?: () => void; onSearch?: () => void; onNext?: () => void; onExit?: () => void; sessionID?: string; width?: number; height?: number; keyboardMode?: string }) {
  const { controller } = props
  const treeRevision = useRevision(controller.tree)
  const searchRevision = useRevision(controller.fileSearch)
  const controllerRevision = useRevision(controller)
  const searching = () => { searchRevision(); return Boolean(controller.fileSearch.query.trim()) }
  const state = () => { treeRevision(); searchRevision(); return searching() ? controller.fileSearch : controller.tree }
  const tree = () => {
    const value = state()
    return { items: searching() ? controller.fileSearch.rows : controller.tree.items, selected: value.selected, scrollTop: value.scrollTop }
  }
  let scroll: ScrollBoxRenderable | undefined
  let panel: BoxRenderable | undefined
  let displayedState = state()
  const [range, setRange] = createSignal(virtualRange(tree().items.length, tree().scrollTop, props.height ?? 20))
  const rows = createMemo(() => { treeRevision(); return tree().items.slice(range().start, range().end) })
  const activate = async (index = tree().selected) => {
    props.onFocus()
    state().select(index)
    const item = tree().items[index]
    if (item?.directory) await state().toggle(index)
    else if (item) await controller.open(item.path, props.sessionID)
  }
  controller.context.keymap.layer(() => {
    controllerRevision()
    return { mode: props.keyboardMode, target: () => panel, enabled: props.focused() && !controller.modal, priority: 45, commands: [
      { bind: "up", run: () => state().move(-1) }, { bind: "down", run: () => state().move(1) },
      { bind: "return", run: () => controller.run(() => activate()) },
      { bind: "right", run: () => controller.run(() => activate()) },
      { bind: "left", run: () => controller.run(async () => { await state().collapse() }) },
      { bind: "f5", run: () => controller.run(async () => { await controller.tree.refresh(); if (controller.fileSearch.query) await controller.fileSearch.refresh(); await controller.changes.refresh() }) },
      { bind: "escape", run: () => { if (searching()) void controller.fileSearch.search(""); else { controller.focusFiles(false); props.onExit?.() } } },
      ...(props.onSearch ? [{ bind: "/", run: props.onSearch }] : []),
      ...(props.onNext ? [{ bind: "tab", run: props.onNext }] : []),
    ] }
  })
  const measure = () => {
    if (!scroll) return
    // Only the editor route owns persistent focus. A sidebar must never reclaim
    // input from the host prompt after the user focuses the conversation.
    const mode = props.keyboardMode ?? controller.filesInputMode
    if (!props.sessionID && mode !== undefined && props.focused() && !controller.modal && controller.context.keymap.mode.current() === mode && panel && !panel.isDestroyed && !panel.focused) panel.focus()
    state().scrollTop = scroll.scrollTop
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
    treeRevision(); searchRevision()
    if (scroll && displayedState !== state()) scroll.scrollTop = state().scrollTop
    displayedState = state()
    if (scroll) scroll.scrollTop = scrollTopForSelected(tree().items.length, tree().selected, scroll.scrollTop, scroll.viewport.height || 20)
    measure()
  })
  onMount(() => { controller.context.renderer.on("frame", measure); void controller.run(() => controller.tree.refresh()) })
  onCleanup(() => { measure(); controller.context.renderer.off("frame", measure) })
  return <box id="oec-files-pane" ref={(value) => { panel = value }} focusable focused={props.focused() && !controller.modal}
    on:blurred={props.onBlur}
    width={props.width ?? "100%"} height={props.height} flexGrow={props.height === undefined ? 1 : 0} minHeight={0} flexShrink={0} flexDirection="column"
    border={["left"]} borderColor={controller.context.theme.text.muted} onMouseDown={props.onFocus}>
    <text fg={controller.context.theme.text.base}> FILES · ↑↓ Enter</text>
    <scrollbox ref={(value) => { scroll = value; value.scrollTop = tree().scrollTop; measure() }} flexGrow={1} minHeight={0} scrollY>
      <box height={range().top} flexShrink={0} />
      <For each={rows()}>{(item, index) => {
        const logicalIndex = () => range().start + index()
        return <box id={`oec-tree-${logicalIndex()}`} height={1} flexShrink={0} paddingLeft={item.depth + 1} flexDirection="row" overflow="hidden"
          backgroundColor={logicalIndex() === tree().selected ? controller.context.theme.background.raised.base : undefined}
          onMouseDown={(event) => { event.stopPropagation(); void controller.run(() => activate(logicalIndex())) }}>
          <text flexShrink={0} fg={controller.context.theme.text.muted}>{item.directory ? item.expanded ? "▾ " : "▸ " : "  "}</text>
          <ScrollingName name={item.name} selected={() => logicalIndex() === tree().selected} active={() => !controller.modal}
            color={item.ignored ? controller.context.theme.text.muted : controller.context.theme.text.base} />
        </box>
      }}</For>
      <box height={range().bottom} flexShrink={0} />
    </scrollbox>
  </box>
}
