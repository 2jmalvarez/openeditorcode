/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js"
import { DocumentTabs } from "../documents/DocumentTabs"
import { FindPanel } from "../../../../src/editor/FindPanel"
import { findMatches } from "../../../../src/editor/find"
import type { EditorController } from "../integration/controller"
import { isEditable } from "../documents/workspace"
import { ReadOnlyPane } from "../documents/ReadOnlyPane"
import { ProjectPanels } from "../explorer/ProjectPanels"
import { EditorBuffer, type BufferHandle } from "./EditorBuffer"
import { useRevision } from "./reactive"
import { editorCommands } from "./useKeyboardShortcuts"
import { usePointer } from "../../../../src/ui/usePointer"

export function EditorRoute(props: { controller: EditorController }) {
  const { controller } = props
  const pointer = usePointer(() => !controller.modal)
  const revision = useRevision(controller.workspace)
  const statusRevision = useRevision(controller)
  const active = () => { revision(); return controller.workspace.active }
  const [focus, setFocus] = createSignal<"editor" | "explorer" | "search" | "panels">(active() ? "editor" : "explorer")
  const [handle, setHandle] = createSignal<BufferHandle>()
  const [findOpen, setFindOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [findIndex, setFindIndex] = createSignal(0)
  const results = createMemo(() => findMatches(active()?.content ?? "", query()))
  const modal = () => { statusRevision(); return controller.modal }
  const source = () => { revision(); return isEditable(active()) && active()?.view !== "preview" }
  const editor = () => handle()?.editor()
  const focusEditor = () => { setFindOpen(false); setFocus("editor") }
  const focusExplorer = () => {
    setFindOpen(false)
    if (!controller.editorFilesVisible) {
      if (controller.diffVisible) {
        setFocus("panels")
        controller.context.renderer.root.findDescendantById(controller.diffExpanded ? "oec-changes-pane" : "oec-diff-toggle")?.focus()
      } else focusEditor()
    } else {
      setFocus(controller.filesExpanded ? "explorer" : "panels")
      if (!controller.filesExpanded) controller.context.renderer.root.findDescendantById("oec-files-toggle")?.focus()
    }
  }
  // Cursor/content revisions must not refocus the editor while search owns input.
  const activePath = createMemo(() => active()?.path)
  createEffect(on(activePath, (path) => { setFindOpen(false); setFocus(path ? "editor" : "explorer") }))
  const popMode = controller.context.keymap.mode.push("oec-editor")
  onCleanup(popMode)
  const editorAction = (action: "find" | "focus") => {
    focusEditor()
    if (action === "find" && source()) { setFindOpen(true); setFindIndex(0) }
  }
  onMount(() => { controller.editorAction = editorAction })
  onCleanup(() => { if (controller.editorAction === editorAction) controller.editorAction = undefined })
  controller.context.keymap.layer(() => ({
    mode: "oec-editor", priority: 40, enabled: !modal(),
    commands: editorCommands({ controller, focused: focus, editor, findOpen,
      openFind: () => { setFindOpen(true); setFindIndex(0) }, closeFind: () => setFindOpen(false),
      moveFind: (direction) => setFindIndex((index) => Math.max(0, Math.min(index + direction, results().length - 1))),
      acceptFind: () => { const result = results()[findIndex()]; if (result) editor()?.setCursor(result.line - 1, result.column - 1); setFindOpen(false) },
      cycleFocus: () => { if (focus() === "editor" || focus() === "search") focusExplorer(); else focusEditor() }, focusEditor, focusExplorer,
    }),
  }))
  const poll = setInterval(() => { if (!controller.modal) void controller.run(() => controller.workspace.checkExternal()) }, 3000)
  onCleanup(() => { clearInterval(poll); handle()?.capture(); void controller.drafts.flush() })
  return <box id="oec-editor-route" height="100%" flexGrow={1} minHeight={0} flexDirection="column" backgroundColor={controller.context.theme.background.base}>
    <box height={1} flexShrink={0} flexDirection="row" backgroundColor={controller.context.theme.background.raised.base}>
      <text {...pointer} fg={controller.context.theme.text.base} onMouseDown={() => void controller.run(() => controller.back())}> ← Conversation </text>
      <text fg={controller.context.theme.text.muted}>│ OEC · {controller.workspace.root}</text>
    </box>
    <box flexGrow={1} minHeight={0} flexDirection="row">
      <box flexGrow={1} minWidth={0} minHeight={0} flexDirection="column">
         <DocumentTabs controller={controller} onFocus={focusEditor} />
        <Show when={active()?.conflict}><text fg="#f2c66d"> File changed or deleted on disk. Local edits retained. Use OEC: reload file from disk.</text></Show>
        <box flexGrow={1} minHeight={0} position="relative">
          <Show when={active()?.path} keyed fallback={<box flexGrow={1} justifyContent="center" alignItems="center"><text fg={controller.context.theme.text.muted}>OEC · Select a file on the right</text></box>}>
             {(path) => <Show when={source()} fallback={<ReadOnlyPane controller={controller} document={controller.workspace.documents.find((document) => document.path === path)!} focused={() => focus() === "editor" && !modal()} onFocus={focusEditor} />}>
               <EditorBuffer controller={controller} document={controller.workspace.documents.find((document) => document.path === path)!}
                 focused={() => focus() === "editor" && !findOpen() && !modal()} onFocus={focusEditor} onHandle={(value) => setHandle(() => value)} />
             </Show>}
          </Show>
          <FindPanel open={() => findOpen() && !modal()} query={query} results={results} index={findIndex}
            onQuery={(value) => { setQuery(value); setFindIndex(0) }} maxWidth={() => 70} />
        </box>
      </box>
      <ProjectPanels controller={controller} editor focused={() => focus() === "explorer" && !modal()}
        onFocus={focusExplorer} onSearchFocus={() => { setFindOpen(false); setFocus("search") }}
        onOtherFocus={() => { setFindOpen(false); setFocus("panels") }} onExit={focusEditor} />
    </box>
    <text height={1} fg={controller.context.theme.text.muted}>{(() => { statusRevision(); revision(); const document = active(); return `${controller.status}  ·  ${focus()}  ·  ${document ? `${document.position.row + 1}:${document.position.column + 1}` : ""}  · Ctrl+S save / Ctrl+F find / Ctrl+L wrap / Tab focus` })()}</text>
  </box>
}
