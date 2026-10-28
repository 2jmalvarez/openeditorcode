/** @jsxImportSource @opentui/solid */
import type { InputRenderable, KeyEvent } from "@opentui/core"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { resolve } from "node:path"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"
import { paletteCommands } from "../integration/palette"
import { usePointer } from "../../../../src/ui/usePointer"

export function FileSearchPane(props: { controller: EditorController; sessionID?: string; keyboardMode?: string; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const pointer = usePointer(() => !controller.modal)
  const search = controller.fileSearch
  const revision = useRevision(search)
  const controllerRevision = useRevision(controller)
  const state = () => { revision(); return search }
  const modal = () => { controllerRevision(); return controller.modal }
  const [focused, setFocused] = createSignal(false)
  let input: InputRenderable | undefined
  let disposed = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const open = () => controller.run(async () => {
    const item = search.rows[search.selected]
    if (!item || disposed) return
    if (item.directory) search.toggle()
    else await controller.open(item.path, props.sessionID)
  })
  controller.context.keymap.layer(() => ({ mode: props.keyboardMode, target: () => input, priority: 55, enabled: focused() && !modal(), commands: [
    { bind: "up", run: () => search.move(-1) }, { bind: "down", run: () => search.move(1) },
    { bind: "return", run: open },
    { bind: "escape", run: () => { if (search.query) { void search.search(""); props.focusTree() } else { input?.blur(); props.releaseFocus() } } },
    { bind: "f5", run: () => controller.run(() => search.refresh()) },
    { bind: "ctrl+e", run: () => controller.toggleSearchMode() },
    { bind: "ctrl+f", run: () => controller.run(() => search.toggleTarget()) },
    { bind: "tab", run: props.focusTree },
  ].map((command) => ({ ...command, run: (_input?: string, event?: KeyEvent) => {
    event?.preventDefault(); event?.stopPropagation()
    return command.run()
  } })).map((command) => paletteCommands("files.search", [command])[0]!) }))
  onMount(() => {
    search.invalidate()
    if (search.query.trim()) void search.refresh()
  })
  const stop = controller.context.data.on("filesystem.changed", (event) => {
    if (!event.location || event.location.workspaceID || resolve(event.location.directory) !== search.root) return
    search.invalidate()
    if (!search.query.trim() || refreshTimer) return
    refreshTimer = setTimeout(() => { refreshTimer = undefined; void search.refresh() }, 150)
  })
  onCleanup(() => { disposed = true; clearTimeout(refreshTimer); stop() })
  return <box id="oec-files-search-controls" flexDirection="column" flexShrink={0}>
    <box height={1} flexDirection="row" minWidth={0} flexShrink={0}>
    <input id="oec-files-search" ref={(value) => { input = value }} value={state().query} maxLength={256}
      placeholder={state().target === "content" ? "Search content…" : "Search files…"} flexGrow={1} minWidth={1} textColor={controller.context.theme.text.base}
      backgroundColor={controller.context.theme.background.raised.base}
      onMouseDown={(event) => { event.stopPropagation(); props.onFocus(); input?.focus() }}
      on:focused={() => { props.onFocus(); setFocused(true) }} on:blurred={() => setFocused(false)}
      onInput={(value) => void search.search(value)} onSubmit={() => { if (!controller.modal) void open() }} />
    <text id="oec-search-mode" {...pointer} width={11} flexShrink={0} wrapMode="none" fg={controller.context.theme.text.muted}
      onMouseDown={(event) => { event.stopPropagation(); if (!controller.modal) void controller.run(() => search.toggleTarget()) }}>{state().target === "content" ? " Name ^F" : state().mode === "fuzzy" ? " Fuzzy ^F" : " Literal ^F"}</text>
    </box>
    <Show when={state().query.trim()}>
      <text fg={controller.context.theme.text.muted}>{state().loading ? " Searching…" : state().error ? ` ${state().error}` : ` ${state().items.length} results${state().resultsLimited ? " · first 80" : ""}${state().truncated ? " · index limited" : ""} · ↑↓ Enter`}</text>
      <Show when={!state().loading && !state().error && !state().items.length}><text fg={controller.context.theme.text.muted}> No matching files</text></Show>
    </Show>
  </box>
}
