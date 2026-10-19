/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { scrollTopForSelected, virtualRange } from "../../../../src/explorer/virtual-rows"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"

export function ChangesPane(props: { controller: EditorController; sessionID: string; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const state = controller.changes
  const revision = useRevision(state)
  const controllerRevision = useRevision(controller)
  const changes = () => { revision(); return state }
  const [focused, setFocused] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const [range, setRange] = createSignal(virtualRange(0, 0, 6))
  let panel: BoxRenderable | undefined
  let scroll: ScrollBoxRenderable | undefined
  let disposed = false
  const modal = () => { controllerRevision(); return controller.modal }
  const rows = createMemo(() => { revision(); return state.files.slice(range().start, range().end) })
  const open = () => {
    if (disposed || controller.modal || !controller.accepts(props.sessionID)) return
    const route = controller.context.ui.router.current()
    if (route.type !== "session" || route.sessionID !== props.sessionID) return
    // The public command opens the native viewer; no documented file argument exists.
    if (!controller.context.keymap.commands().some((command) => command.id === "diff.open")) {
      controller.context.ui.toast.show({ title: "OEC", message: "OpenCode's diff viewer is not available in this context.", variant: "warning" })
      return
    }
    controller.focusFiles(false)
    controller.context.keymap.dispatch("diff.open")
  }
  const measure = () => {
    if (!scroll) return
    const next = virtualRange(state.files.length, scroll.scrollTop, scroll.viewport.height || 6)
    const current = range()
    if (next.start !== current.start || next.end !== current.end || next.bottom !== current.bottom) setRange(next)
  }
  const move = (direction: number) => setSelected((value) => Math.max(0, Math.min(value + direction, state.files.length - 1)))
  controller.context.keymap.layer(() => ({ target: () => panel, priority: 35, enabled: focused() && !modal(), commands: [
    { bind: "up", run: () => move(-1) }, { bind: "down", run: () => move(1) },
    { bind: "return", run: open }, { bind: "f5", run: () => state.refresh() },
    { bind: "shift+tab", run: props.focusTree }, { bind: "escape,tab", run: props.releaseFocus },
  ] }))
  createEffect(() => {
    revision()
    setSelected((value) => Math.max(0, Math.min(value, state.files.length - 1)))
    if (scroll) scroll.scrollTop = scrollTopForSelected(state.files.length, selected(), scroll.scrollTop, scroll.viewport.height || 6)
    measure()
  })
  onMount(() => { state.start(props.sessionID); controller.context.renderer.on("frame", measure) })
  onCleanup(() => { disposed = true; state.stop(); controller.context.renderer.off("frame", measure) })
  return <box id="oec-changes-pane" ref={(value) => { panel = value }} focusable flexDirection="column" flexShrink={0}
    on:focused={() => { props.onFocus(); setFocused(true) }} on:blurred={() => setFocused(false)}
    onMouseDown={(event) => { event.stopPropagation(); props.onFocus(); panel?.focus() }}>
    <text fg={controller.context.theme.text.base}> CHANGES · {changes().files.length} · Enter: OpenCode diff</text>
    <Show when={changes().error}><text fg={controller.context.theme.text.muted}> {changes().error} · F5 to retry</text></Show>
    <Show when={!changes().error && changes().repository === undefined}><text fg={controller.context.theme.text.muted}> Loading changes…</text></Show>
    <Show when={!changes().error && changes().repository === false}><text fg={controller.context.theme.text.muted}> No repository</text></Show>
    <Show when={!changes().error && changes().repository && !changes().files.length}><text fg={controller.context.theme.text.muted}> No changes</text></Show>
    <Show when={changes().files.length}>
      <scrollbox ref={(value) => { scroll = value }} height={Math.min(changes().files.length, 6)} scrollY onSizeChange={measure}>
        <box height={range().top} flexShrink={0} />
        <For each={rows()}>{(file, index) => <box height={1} flexShrink={0}
          backgroundColor={range().start + index() === selected() && focused() ? controller.context.theme.background.raised.base : undefined}
          onMouseUp={(event) => { event.stopPropagation(); if (event.button === 0) { setSelected(range().start + index()); queueMicrotask(open) } }}>
          <text wrapMode="none" fg={controller.context.theme.text.base}> {file.status === "added" ? "A" : file.status === "deleted" ? "D" : "M"} {file.file} +{file.additions} −{file.deletions}</text>
        </box>}</For>
        <box height={range().bottom} flexShrink={0} />
      </scrollbox>
    </Show>
  </box>
}
