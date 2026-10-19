/** @jsxImportSource @opentui/solid */
import type { InputRenderable, ScrollBoxRenderable } from "@opentui/core"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { relative, resolve } from "node:path"
import type { EditorController } from "../integration/controller"
import { useRevision } from "../workbench/reactive"

export function FileSearchPane(props: { controller: EditorController; sessionID: string; onFocus: () => void; focusTree: () => void; releaseFocus: () => void }) {
  const { controller } = props
  const search = controller.fileSearch
  const revision = useRevision(search)
  const controllerRevision = useRevision(controller)
  const state = () => { revision(); return search }
  const modal = () => { controllerRevision(); return controller.modal }
  const [focused, setFocused] = createSignal(false)
  let input: InputRenderable | undefined
  let results: ScrollBoxRenderable | undefined
  let disposed = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const open = () => controller.run(async () => {
    const item = search.items[search.selected]
    if (item && !disposed) await controller.open(item.path, props.sessionID)
  })
  controller.context.keymap.layer(() => ({ target: () => input, priority: 35, enabled: focused() && !modal(), commands: [
    { bind: "up", run: () => search.move(-1) }, { bind: "down", run: () => search.move(1) },
    { bind: "escape", run: () => { if (search.query) { void search.search(""); props.focusTree() } else { input?.blur(); props.releaseFocus() } } },
    { bind: "f5", run: () => controller.run(() => search.refresh()) },
    { bind: "tab", run: () => { void search.search(""); props.focusTree() } },
  ] }))
  createEffect(() => {
    revision()
    if (results) {
      const selected = search.selected
      if (selected < results.scrollTop) results.scrollTop = selected
      else if (selected >= results.scrollTop + results.viewport.height) results.scrollTop = Math.max(0, selected - results.viewport.height + 1)
    }
  })
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
  return <box flexDirection="column" flexShrink={0}>
    <input id="oec-files-search" ref={(value) => { input = value }} value={state().query} maxLength={256}
      placeholder="Search files…" textColor={controller.context.theme.text.base}
      backgroundColor={controller.context.theme.background.raised.base}
      onMouseDown={(event) => { event.stopPropagation(); props.onFocus(); input?.focus() }}
      on:focused={() => { props.onFocus(); setFocused(true) }} on:blurred={() => setFocused(false)}
      onInput={(value) => void search.search(value)} onSubmit={() => { if (!controller.modal) void open() }} />
    <Show when={state().query.trim()}>
      <text fg={controller.context.theme.text.muted}>{state().loading ? " Searching…" : state().error ? ` ${state().error}` : ` ${state().items.length} results${state().truncated ? " · index limited" : ""} · ↑↓ Enter`}</text>
      <Show when={!state().loading && !state().error && !state().items.length}><text fg={controller.context.theme.text.muted}> No matching files</text></Show>
      <scrollbox ref={(value) => { results = value }} height={Math.max(1, Math.min(state().items.length, 12))} scrollY>
        <For each={state().items}>{(item, index) => <box height={1} flexShrink={0}
          backgroundColor={index() === state().selected ? controller.context.theme.background.raised.base : undefined}
          onMouseDown={(event) => { event.stopPropagation(); event.preventDefault() }}
          onMouseUp={(event) => { event.stopPropagation(); if (event.button === 0) { search.selected = index(); queueMicrotask(() => { void open() }) } }}>
          <text wrapMode="none" fg={controller.context.theme.text.base}> {relative(search.root, item.path)}</text>
        </box>}</For>
      </scrollbox>
    </Show>
  </box>
}
