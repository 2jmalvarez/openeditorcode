/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, KeyEvent } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { changeTree } from "./tree"
import { useTreeViewport } from "../explorer/useTreeViewport"
import { OEC_GROUP } from "../integration/reference"

export function ChangesPane(props: { controller: EditorController; sessionID?: string; keyboardMode?: string; height?: number; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const state = controller.changes
  const revision = useRevision(state)
  const controllerRevision = useRevision(controller)
  const changes = () => { revision(); return state }
  const [focused, setFocused] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const [navigation, setNavigation] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())
  const tree = createMemo(() => { revision(); return changeTree(state.files, collapsed()) })
  let selectedID: string | undefined
  let panel: BoxRenderable | undefined
  const viewport = useTreeViewport({ owner: () => state, navigation, total: () => tree().length, selected })
  const range = viewport.range
  let disposed = false
  const modal = () => { controllerRevision(); return controller.modal }
  const rows = createMemo(() => tree().slice(range().start, range().end))
  const select = (index: number) => { const next = Math.max(0, Math.min(index, tree().length - 1)); selectedID = tree()[next]?.id; setSelected(next); setNavigation((value) => value + 1) }
  const toggle = () => {
    const row = tree()[selected()]
    if (!row?.directory) return
    const next = new Set(collapsed())
    if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
    setCollapsed(next)
    setNavigation((value) => value + 1)
  }
  const open = () => {
    if (disposed || controller.modal) return
    const row = tree()[selected()]
    if (row?.directory) { toggle(); return }
    const file = row?.change
    if (file) void controller.run(() => controller.openDiff(file, props.sessionID))
  }
  const measure = viewport.measure
  const move = (direction: number) => select(selected() + direction)
  controller.context.keymap.layer(() => ({ mode: props.keyboardMode, target: () => panel, priority: 55, enabled: focused() && !modal(), commands: [
    { bind: "up", run: () => move(-1) }, { bind: "down", run: () => move(1) },
    { id: "oec.diff.page.up", title: "Previous Diff page", group: OEC_GROUP, palette: true as const, bind: "pageup", run: () => move(-viewport.pageSize()) },
    { id: "oec.diff.page.down", title: "Next Diff page", group: OEC_GROUP, palette: true as const, bind: "pagedown", run: () => move(viewport.pageSize()) },
    { id: "oec.diff.first", title: "First changed file or folder", group: OEC_GROUP, palette: true as const, bind: "home", run: () => select(0) },
    { id: "oec.diff.last", title: "Last changed file or folder", group: OEC_GROUP, palette: true as const, bind: "end", run: () => select(tree().length - 1) },
    { bind: "return", run: open }, { bind: "f5", run: () => state.refresh() },
    { bind: "right", run: () => { if (!tree()[selected()]?.expanded) open(); else move(1) } },
    { bind: "left", run: () => { const row = tree()[selected()]; if (row?.expanded) toggle(); else { const parent = tree().findIndex((entry) => entry.id === row?.parent); if (parent >= 0) select(parent) } } },
    { bind: "shift+tab", run: props.focusTree }, { bind: "escape,tab", run: props.releaseFocus },
  ].map((command) => ({ ...command, run: (_input?: string, event?: KeyEvent) => {
    event?.preventDefault(); event?.stopPropagation()
    return command.run()
  } })) }))
  createEffect(on(tree, () => {
    const retained = tree().findIndex((row) => row.id === selectedID)
    const next = retained >= 0 ? retained : Math.max(0, Math.min(selected(), tree().length - 1))
    selectedID = tree()[next]?.id
    setSelected(next)
  }))
  onMount(() => { state.start(props.sessionID); controller.context.renderer.on("frame", measure) })
  onCleanup(() => {
    disposed = true; state.stop(); controller.context.renderer.off("frame", measure)
    if (focused() && !controller.modal && controller.context.keymap.mode.current() === (props.keyboardMode ?? controller.filesInputMode)) props.releaseFocus()
  })
  return <box id="oec-changes-pane" ref={(value) => { panel = value }} focusable flexDirection="column" height={props.height ?? 8}
    minHeight={0} flexShrink={props.keyboardMode ? 1 : 0} overflow="hidden"
    on:focused={() => { props.onFocus(); setFocused(true) }} on:blurred={() => setFocused(false)}
    onMouseDown={(event) => { event.stopPropagation(); props.onFocus(); panel?.focus() }}>
    <text wrapMode="none" flexShrink={0} fg={controller.context.theme.text.muted}> {changes().files.length} · Enter: diff tab</text>
    <Show when={changes().error}><text fg={controller.context.theme.text.muted}> {changes().error} · F5 to retry</text></Show>
    <Show when={!changes().error && changes().repository === undefined}><text fg={controller.context.theme.text.muted}> Loading changes…</text></Show>
    <Show when={!changes().error && changes().repository === false}><text fg={controller.context.theme.text.muted}> No repository</text></Show>
    <Show when={!changes().error && changes().repository && !changes().files.length}><text fg={controller.context.theme.text.muted}> No changes</text></Show>
    <Show when={changes().files.length}>
       <scrollbox id="oec-diff-scroll" ref={viewport.attach} flexGrow={1} flexBasis={0} minHeight={0} scrollY onSizeChange={measure} viewportOptions={{ overflow: "hidden" }}>
        <box height={range().top} flexShrink={0} />
        <For each={rows()}>{(row, index) => <box height={1} flexShrink={0} paddingLeft={row.depth} minWidth={0} overflow="hidden"
          backgroundColor={range().start + index() === selected() && focused() ? controller.context.theme.background.raised.base : undefined}
          onMouseUp={(event) => { event.stopPropagation(); if (event.button === 0) { select(range().start + index()); queueMicrotask(open) } }}>
            <text wrapMode="none" fg={controller.context.theme.text.base}>{row.directory ? `${row.expanded ? "▾" : "▸"} ${row.name}` : `${row.change!.area === "staged" ? "●" : "○"} ${row.change!.status === "untracked" ? "?" : row.change!.status[0].toUpperCase()} ${row.name} +${row.change!.additions ?? "?"} −${row.change!.deletions ?? "?"}`}</text>
        </box>}</For>
        <box height={range().bottom} flexShrink={0} />
      </scrollbox>
    </Show>
  </box>
}
