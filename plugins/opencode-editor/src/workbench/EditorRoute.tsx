/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"
import { DocumentTabs } from "../../../../src/documents/DocumentTabs"
import { FindPanel } from "../../../../src/editor/FindPanel"
import { findMatches } from "../../../../src/editor/find"
import type { OpenTab } from "../../../../src/documents/types"
import type { EditorController } from "../integration/controller"
import { isDirty } from "../documents/workspace"
import { FilesPane } from "../explorer/FilesPane"
import { EditorBuffer, type BufferHandle } from "./EditorBuffer"
import { useRevision } from "./reactive"
import { editorCommands } from "./useKeyboardShortcuts"

export function EditorRoute(props: { controller: EditorController }) {
  const { controller } = props
  const revision = useRevision(controller.workspace)
  const statusRevision = useRevision(controller)
  const active = () => { revision(); return controller.workspace.active }
  const [focus, setFocus] = createSignal<"editor" | "explorer">(active() ? "editor" : "explorer")
  const [handle, setHandle] = createSignal<BufferHandle>()
  const [findOpen, setFindOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [findIndex, setFindIndex] = createSignal(0)
  const results = createMemo(() => findMatches(active()?.content ?? "", query()))
  const modal = () => { statusRevision(); return controller.modal }
  const tabs = createMemo<OpenTab[]>(() => { revision(); return controller.workspace.documents.map((document) => ({ kind: "file", source: "project", path: document.path, content: document.content, savedContent: document.savedContent, view: "source" })) })
  const editor = () => handle()?.editor()
  const focusEditor = () => { setFindOpen(false); setFocus("editor") }
  const focusExplorer = () => { setFindOpen(false); setFocus("explorer") }
  createEffect(on(() => active()?.path, (path) => { setFindOpen(false); setFocus(path ? "editor" : "explorer") }))
  const popMode = controller.context.keymap.mode.push("oec-editor")
  onCleanup(popMode)
  controller.context.keymap.layer(() => ({
    mode: "oec-editor", priority: 40, enabled: !modal(),
    commands: editorCommands({ controller, focused: focus, editor, findOpen,
      openFind: () => { setFindOpen(true); setFindIndex(0) }, closeFind: () => setFindOpen(false),
      moveFind: (direction) => setFindIndex((index) => Math.max(0, Math.min(index + direction, results().length - 1))),
      acceptFind: () => { const result = results()[findIndex()]; if (result) editor()?.setCursor(result.line - 1, result.column - 1); setFindOpen(false) },
      cycleFocus: () => setFocus((value) => value === "editor" ? "explorer" : "editor"), focusEditor, focusExplorer,
    }),
  }))
  const poll = setInterval(() => { if (!controller.modal) void controller.run(() => controller.workspace.checkExternal()) }, 3000)
  onCleanup(() => { clearInterval(poll); handle()?.capture(); void controller.drafts.flush() })
  return <box id="oec-editor-route" height="100%" flexGrow={1} minHeight={0} flexDirection="column" backgroundColor={controller.context.theme.background.base}>
    <box height={1} flexShrink={0} flexDirection="row" backgroundColor={controller.context.theme.background.raised.base}>
      <text fg={controller.context.theme.text.base} onMouseDown={() => void controller.run(() => controller.back())}> ← Conversation </text>
      <text fg={controller.context.theme.text.muted}>│ OEC · {controller.workspace.root}</text>
    </box>
    <box flexGrow={1} minHeight={0} flexDirection="row">
      <box flexGrow={1} minWidth={0} minHeight={0} flexDirection="column">
        <DocumentTabs tabs={tabs} activeTab={() => { revision(); return controller.workspace.documents.findIndex((document) => document.path === controller.workspace.activePath) }}
          isTabDirty={(index) => { revision(); const document = controller.workspace.documents[index]; return Boolean(document && isDirty(document)) }}
          onActivate={(index) => { const document = controller.workspace.documents[index]; if (document) { setFindOpen(false); controller.activate(document.path); focusEditor() } }}
          onClose={(index) => { const document = controller.workspace.documents[index]; if (document) void controller.run(() => controller.close(document.path)) }} />
        <Show when={active()?.conflict}><text fg="#f2c66d"> File changed or deleted on disk. Local edits retained. Use OEC: reload file from disk.</text></Show>
        <box flexGrow={1} minHeight={0} position="relative">
          <Show when={active()?.path} keyed fallback={<box flexGrow={1} justifyContent="center" alignItems="center"><text fg={controller.context.theme.text.muted}>OEC · Select a file on the right</text></box>}>
            {(path) => <EditorBuffer controller={controller} document={controller.workspace.documents.find((document) => document.path === path)!}
              focused={() => focus() === "editor" && !findOpen() && !modal()} onFocus={focusEditor} onHandle={(value) => setHandle(() => value)} />}
          </Show>
          <FindPanel open={() => findOpen() && !modal()} query={query} results={results} index={findIndex}
            onQuery={(value) => { setQuery(value); setFindIndex(0) }} maxWidth={() => 70} />
        </box>
      </box>
      <FilesPane controller={controller} width={controller.options.explorerWidth} focused={() => focus() === "explorer" && !modal()}
        onFocus={focusExplorer} keyboardMode="oec-editor" />
    </box>
    <text height={1} fg={controller.context.theme.text.muted}>{(() => { statusRevision(); revision(); const document = active(); return `${controller.status}  ·  ${focus()}  ·  ${document ? `${document.position.row + 1}:${document.position.column + 1}` : ""}  · Ctrl+S save / Ctrl+F find / Tab focus` })()}</text>
  </box>
}
