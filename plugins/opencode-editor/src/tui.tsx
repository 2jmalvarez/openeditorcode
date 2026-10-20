/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { KeymapCommand } from "@opencode/plugin/tui/context"
import { createSignal, Show } from "solid-js"
import { EditorProjects } from "./integration/projects"
import { parsePreferences } from "./integration/options"
import { EditorRoute } from "./workbench/EditorRoute"
import { SessionFiles } from "./explorer/SessionFiles"
import { FilesToggle } from "./explorer/FilesToggle"
import { OEC_GROUP, SHORTCUTS, showSettings } from "./integration/reference"
import { conversationCommands } from "./integration/palette"

export default Plugin.define({
  id: "oec.editor",
  setup(context) {
    const projects = new EditorProjects(context)
    const preferences = parsePreferences(context.options)
    const [revision, setRevision] = createSignal(0)
    const stop = projects.subscribe(() => setRevision((value) => value + 1))
    const unregisterRoute = context.ui.router.register({ name: "oec.editor", render: () => <Show when={(() => { revision(); return projects.current() })()} keyed>{(controller) => <EditorRoute controller={controller} />}</Show> })
    const unregisterFiles = context.ui.slot({ append: "sidebar.content", render: (props) => <Show when={(() => { revision(); return projects.forSession(props.sessionID) })()} keyed fallback={<FilesToggle context={context} label="▸ Files" toggle={() => void projects.run(() => projects.toggleFiles())} />}>{(controller) => <SessionFiles controller={controller} sessionID={props.sessionID} />}</Show> })
    context.keymap.layer(() => { revision(); return { mode: "global", priority: 10, enabled: !projects.modal, commands: ([
      { id: "oec.toggle", title: "OEC: toggle conversation/editor", group: "OEC", palette: true, bind: preferences.toggleBinding, slash: { name: "oec" }, run: () => projects.run(() => projects.toggle()) },
      { id: "oec.files", title: "Show/hide Files", group: "OEC", palette: true, bind: preferences.filesBinding, run: () => projects.run(() => projects.toggleFiles()) },
      { id: "oec.diff", title: "OEC: show/hide Diff", group: "OEC", palette: true, bind: preferences.diffBinding, run: () => projects.run(() => projects.toggleDiff()) },
      { id: "oec.clearDrafts", title: "OEC: delete stored drafts for this project", group: "OEC", palette: true, run: () => projects.run(async () => { await projects.current()?.clearStoredDrafts() }) },
      { id: "oec.access.forget", title: "OEC: forget remembered folder access", group: "OEC", palette: true, run: () => projects.run(() => projects.forgetLocalAccess()) },
      { id: "oec.help", title: "All keyboard shortcuts", group: "OEC", palette: true, bind: false, run: () => projects.run(async () => { const current = projects.current(); const show = () => context.ui.dialog.alert({ title: "OEC · Shortcuts", message: SHORTCUTS.replace("F6 (toggleBinding)", `${preferences.toggleBinding} (toggleBinding)`).replace("F7 (filesBinding)", `${preferences.filesBinding} (filesBinding)`).replace("F8 (diffBinding)", `${preferences.diffBinding} (diffBinding)`) }); if (current) await current.dialog(show); else await show() }) },
      { id: "oec.settings", title: "OEC: plugin configuration", group: "OEC", palette: true, bind: false, run: () => projects.run(() => showSettings(context, preferences, projects.current())) },
      { id: "oec.search.mode", title: "OEC: toggle fuzzy/literal file search", group: "OEC", palette: true, bind: false, enabled: () => Boolean(projects.current()), run: () => projects.current()?.toggleSearchMode() },
      { id: "oec.diff.layout", title: "OEC: toggle split/unified diff", group: "OEC", palette: true, bind: false, enabled: () => Boolean(projects.current()), run: () => projects.current()?.toggleDiffView() },
      { id: "oec.markdown.default", title: "OEC: toggle default Markdown preview", group: "OEC", palette: true, bind: false, enabled: () => Boolean(projects.current()), run: () => projects.current()?.toggleMarkdownDefault() },
      { id: "oec.image.protocol", title: "OEC: toggle image auto/blocks protocol", group: "OEC", palette: true, bind: false, enabled: () => Boolean(projects.current()), run: () => projects.current()?.toggleImageProtocol() },
      ...(context.ui.router.current().type === "plugin" ? [] : conversationCommands(projects)),
    ] satisfies KeymapCommand[]).map((command) => ({ ...command, title: command.title?.replace(/^OEC: /, ""), group: OEC_GROUP })) } })
    return async () => { unregisterFiles(); unregisterRoute(); stop(); await projects.dispose() }
  },
})
