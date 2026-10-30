/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, KeyEvent, ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { changeTree } from "./tree"
import { useTreeViewport } from "../explorer/useTreeViewport"
import { OEC_GROUP } from "../integration/reference"
import { changePresentation } from "./presentation"
import { paletteCommands } from "../integration/palette"
import { usePointer } from "../../../../src/ui/usePointer"
import { createDiffViewState, type DiffViewState } from "./view-state"
import { diffVisualRows } from "./visual-rows"
import { useTranslation } from "../localization"

export function ChangesPane(props: { controller: EditorController; view?: DiffViewState; sessionID?: string; keyboardMode?: string; height?: number; fill?: boolean; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const t = useTranslation(controller)
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
  const view = props.view ?? createDiffViewState()
  const { collapsed, setCollapsed } = view
  // Until layout is measured, avoid creating artificial one-character lines.
  const [width, setWidth] = createSignal(Number.POSITIVE_INFINITY)
  const tree = createMemo(() => { revision(); return changeTree(state.files, collapsed(), state.repositories, { loading: state.loading, stale: state.stale }) })
  const [loadingFrame, setLoadingFrame] = createSignal(0)
  const loadingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  createEffect(() => {
    if (!changes().loading) return
    setLoadingFrame(0)
    const timer = setInterval(() => setLoadingFrame((frame) => (frame + 1) % loadingFrames.length), 100)
    onCleanup(() => clearInterval(timer))
  })
  const visual = createMemo(() => diffVisualRows(tree(), width(), view.wrap(), t("Branch unavailable")), undefined, {
    equals: (previous, next) => previous.length === next.length && previous.every((entry, index) => {
      const other = next[index]!
      return entry.row === other.row && entry.label === other.label && entry.branch === other.branch && entry.part === other.part && entry.index === other.index && entry.last === other.last
    }),
  })
  let selectedID: string | undefined
  let panel: BoxRenderable | undefined
  let scroll: ScrollBoxRenderable | undefined
  const visualSelected = () => Math.max(0, visual().findIndex((entry) => entry.index === selected()))
  const viewport = useTreeViewport({ owner: () => state, navigation, total: () => visual().length, selected: visualSelected,
    selectedEnd: () => Math.max(0, visual().findLastIndex((entry) => entry.index === selected())) })
  const range = viewport.range
  let disposed = false
  const modal = () => { controllerRevision(); return controller.modal }
  const rows = createMemo(() => visual().slice(range().start, range().end))
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
  const measure = () => { if (scroll && !scroll.isDestroyed) setWidth(Math.max(1, scroll.viewport.width)); viewport.measure() }
  const move = (direction: number) => select(selected() + direction)
  const page = (direction: number) => {
    const index = Math.max(0, Math.min(visual().length - 1, visualSelected() + direction * viewport.pageSize()))
    const next = visual()[index]?.index ?? 0
    select(next === selected() ? selected() + direction : next)
  }
  controller.context.keymap.layer(() => ({ mode: props.keyboardMode, target: () => panel, priority: 55, enabled: focused() && !modal(), commands: [
    { id: "oec.diff.collapse.all", title: "Collapse all Diff repositories and folders", group: OEC_GROUP, palette: true as const, run: () => view.collapseAll(state.files, state.repositories) },
    { id: "oec.diff.wrap", title: "Toggle Diff repository and branch name wrapping", group: OEC_GROUP, palette: true as const, run: view.toggleWrap },
    { bind: "up", run: () => move(-1) }, { bind: "down", run: () => move(1) },
    { id: "oec.diff.page.up", title: "Previous Diff page", group: OEC_GROUP, palette: true as const, bind: "pageup", run: () => page(-1) },
    { id: "oec.diff.page.down", title: "Next Diff page", group: OEC_GROUP, palette: true as const, bind: "pagedown", run: () => page(1) },
    { id: "oec.diff.first", title: "First changed file or folder", group: OEC_GROUP, palette: true as const, bind: "home", run: () => select(0) },
    { id: "oec.diff.last", title: "Last changed file or folder", group: OEC_GROUP, palette: true as const, bind: "end", run: () => select(tree().length - 1) },
    { bind: "return", run: open }, { bind: "f5", run: () => state.refresh() },
    { bind: "right", run: () => { if (!tree()[selected()]?.expanded) open(); else move(1) } },
    { bind: "left", run: () => { const row = tree()[selected()]; if (row?.expanded) toggle(); else { const parent = tree().findIndex((entry) => entry.id === row?.parent); if (parent >= 0) select(parent) } } },
    { bind: "shift+tab", run: props.focusTree }, { bind: "escape,tab", run: props.releaseFocus },
  ].map((command) => ({ ...command, run: (_input?: string, event?: KeyEvent) => {
    event?.preventDefault(); event?.stopPropagation()
    return command.run()
  } })).map((command) => paletteCommands("diff.tree", [command], controller.t)[0]!) }))
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
    <Show when={changes().loading || changes().error || changes().stale || changes().repository !== true || (!changes().files.length && !changes().repositories.length)}><box id="oec-diff-status" flexDirection="column" flexShrink={0}>
    <Show when={changes().loading} fallback={<>
    <Show when={changes().error}><text fg={controller.context.theme.text.muted}> {t(changes().error)} · {t("F5 to retry")}</text></Show>
    <Show when={changes().stale}><text fg={controller.context.theme.text.muted}> {t("Changes may be outdated")} · {t("F5 to retry")}</text></Show>
    <Show when={!changes().error && changes().repository === undefined}><text fg={controller.context.theme.text.muted}> {t("Loading changes…")}</text></Show>
    <Show when={!changes().error && changes().repository === false}><text fg={controller.context.theme.text.muted}> {t("No repository")}</text></Show>
    <Show when={!changes().error && !changes().stale && changes().repository && !changes().files.length && !changes().repositories.length}><text fg={controller.context.theme.text.muted}> {t("No changes")}</text></Show>
    </>}><text fg={controller.context.theme.text.muted}> {loadingFrames[loadingFrame()]} {t("Loading changes…")}</text></Show>
    </box></Show>
    <Show when={changes().files.length || changes().repositories.length}>
        <scrollbox id="oec-diff-scroll" ref={(value) => { scroll = value; viewport.attach(value) }} flexGrow={1} flexBasis={0} minHeight={0} scrollY onSizeChange={measure} viewportOptions={{ overflow: "hidden" }}>
        <box height={range().top} flexShrink={0} />
        <For each={rows()}>{(entry) => { const { row } = entry; return <box id={`oec-diff-row:${row.id}${entry.part ? `:wrap:${entry.part}` : ""}`} {...pointer} height={1} flexDirection="row" flexShrink={0} paddingLeft={row.depth} minWidth={0} overflow="hidden"
          backgroundColor={entry.index === selected() && focused() ? controller.context.theme.background.raised.base : undefined}
          // Like Files, activate on press: a Git refresh may replace this row
          // before release, leaving OpenTUI's mouse-up target detached.
          onMouseDown={(event) => {
            event.stopPropagation()
            if (event.button !== 0 || controller.modal) return
            props.onFocus(); panel?.focus()
            select(entry.index); open()
          }}>
             <Show when={row.change} fallback={<>
               <text wrapMode="none" minWidth={0} flexShrink={row.repository ? 0 : 1} fg={row.detail ? theme.text.muted : theme.text.base}>
                 <Show when={row.repository}><span style={{ fg: row.changedFiles ? "#ffffff" : colors().staged }}>{entry.part ? "  " : "● "}</span></Show>
                {row.repository ? entry.label : row.detail ? t(row.name) : `${row.expanded ? "▾" : "▸"} ${row.name}${row.changedFiles ? ` (${row.changedFiles})` : ""}`}
               </text>
                 <Show when={entry.branch}><box width={0} flexGrow={1} minWidth={0} marginLeft={2} overflow="hidden">
                  <text width="100%" wrapMode="none" textAlign="right" fg={theme.text.muted}>{entry.branch}</text>
                </box></Show>
             </>}>{(change) => {
               const label = () => changePresentation(change())
               return <text wrapMode="none" fg={theme.text.base}>
                 <span style={{ fg: colors()[label().indicator] }}>{label().symbol}</span>{" "}
                 <span style={{ fg: colors()[label().tone] }}>{label().status}</span>{` ${row.name} `}
                 <span style={{ fg: colors().added }}>{label().additions}</span>{" "}
                 <span style={{ fg: colors().removed }}>{label().deletions}</span>
               </text>
             }}</Show>
        </box> }}</For>
        <box height={range().bottom} flexShrink={0} />
      </scrollbox>
    </Show>
  </box>
}
