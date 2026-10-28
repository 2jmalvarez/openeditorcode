/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, KeyEvent } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { changeTree } from "./tree"
import { useTreeViewport } from "../explorer/useTreeViewport"
import { OEC_GROUP } from "../integration/reference"
import { changePresentation } from "./presentation"
import { paletteCommands } from "../integration/palette"
import { usePointer } from "../../../../src/ui/usePointer"

export function ChangesPane(props: { controller: EditorController; sessionID?: string; keyboardMode?: string; height?: number; fill?: boolean; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const pointer = usePointer(() => !controller.modal)
  const theme = controller.context.theme
  const colors = () => ({
    added: theme.diff?.text.added ?? theme.text.base,
    removed: theme.diff?.text.removed ?? theme.text.base,
    modified: theme.text.feedback?.warning.base ?? theme.text.base,
    staged: theme.hue?.blue[200] ?? theme.text.base,
  })
  const state = controller.changes
  const revision = useRevision(state)
  const controllerRevision = useRevision(controller)
  const changes = () => { revision(); return state }
  const [focused, setFocused] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const [navigation, setNavigation] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())
  const tree = createMemo(() => { revision(); return changeTree(state.files, collapsed(), state.repositories) })
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
  } })).map((command) => paletteCommands("diff.tree", [command])[0]!) }))
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
  return <box id="oec-changes-pane" ref={(value) => { panel = value }} focusable flexDirection="column" height={props.fill ? undefined : props.height ?? 8}
    flexGrow={props.fill ? 1 : 0} flexBasis={props.fill ? 0 : undefined}
    minHeight={0} flexShrink={props.fill || props.keyboardMode ? 1 : 0} paddingRight={1} overflow="hidden"
    on:focused={() => { props.onFocus(); setFocused(true) }} on:blurred={() => setFocused(false)}
    onMouseDown={(event) => { event.stopPropagation(); props.onFocus(); panel?.focus() }}>
    <box id="oec-diff-status" flexDirection="column" flexShrink={0}>
    <text wrapMode="none" flexShrink={0} fg={controller.context.theme.text.muted}> {changes().files.length} · Enter: diff tab</text>
    <Show when={changes().error}><text fg={controller.context.theme.text.muted}> {changes().error} · F5 to retry</text></Show>
    <Show when={changes().stale}><text fg={controller.context.theme.text.muted}> Changes may be outdated · F5 to retry</text></Show>
    <Show when={!changes().error && changes().repository === undefined}><text fg={controller.context.theme.text.muted}> Loading changes…</text></Show>
    <Show when={!changes().error && changes().repository === false}><text fg={controller.context.theme.text.muted}> No repository</text></Show>
    <Show when={!changes().error && !changes().stale && changes().repository && !changes().files.length && !changes().repositories.length}><text fg={controller.context.theme.text.muted}> No changes</text></Show>
    </box>
    <Show when={changes().files.length || changes().repositories.length}>
       <scrollbox id="oec-diff-scroll" ref={viewport.attach} flexGrow={1} flexBasis={0} minHeight={0} scrollY onSizeChange={measure} viewportOptions={{ overflow: "hidden" }}>
        <box height={range().top} flexShrink={0} />
        <For each={rows()}>{(row, index) => <box id={`oec-diff-row:${row.id}`} {...pointer} height={1} flexDirection="row" flexShrink={0} paddingLeft={row.depth} minWidth={0} overflow="hidden"
          backgroundColor={range().start + index() === selected() && focused() ? controller.context.theme.background.raised.base : undefined}
          // Like Files, activate on press: a Git refresh may replace this row
          // before release, leaving OpenTUI's mouse-up target detached.
          onMouseDown={(event) => {
            event.stopPropagation()
            if (event.button !== 0 || controller.modal) return
            props.onFocus(); panel?.focus()
            select(range().start + index()); open()
          }}>
             <Show when={row.change} fallback={<>
               <text wrapMode="none" minWidth={0} flexShrink={row.repository ? 0 : 1} fg={row.detail ? theme.text.muted : theme.text.base}>
                <Show when={row.repository}><span style={{ fg: colors().staged }}>● </span></Show>
                {row.detail ? row.name : `${row.expanded ? "▾" : "▸"} ${row.name}${row.changedFiles ? ` (${row.changedFiles})` : ""}`}
               </text>
               <Show when={row.repository}>{(repository) => <box width={0} flexGrow={1} minWidth={0} marginLeft={2} overflow="hidden">
                 <text width="100%" wrapMode="none" textAlign="right" fg={theme.text.muted}>{repository().branch || "Branch unavailable"}</text>
               </box>}</Show>
             </>}>{(change) => {
               const label = () => changePresentation(change())
               return <text wrapMode="none" fg={theme.text.base}>
                 <span style={{ fg: colors()[label().indicator] }}>{label().symbol}</span>{" "}
                 <span style={{ fg: colors()[label().tone] }}>{label().status}</span>{` ${row.name} `}
                 <span style={{ fg: colors().added }}>{label().additions}</span>{" "}
                 <span style={{ fg: colors().removed }}>{label().deletions}</span>
               </text>
             }}</Show>
        </box>}</For>
        <box height={range().bottom} flexShrink={0} />
      </scrollbox>
    </Show>
  </box>
}
