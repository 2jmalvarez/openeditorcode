/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal, Show } from "solid-js"
import { EditorProjects } from "./integration/projects"
import { parsePreferences } from "./integration/options"
import { EditorRoute } from "./workbench/EditorRoute"
import { SessionFiles } from "./explorer/SessionFiles"
import { FilesToggle } from "./explorer/FilesToggle"

export default Plugin.define({
  id: "oec.editor",
  setup(context) {
    const projects = new EditorProjects(context)
    const preferences = parsePreferences(context.options)
    const [revision, setRevision] = createSignal(0)
    const stop = projects.subscribe(() => setRevision((value) => value + 1))
    const unregisterRoute = context.ui.router.register({ name: "oec.editor", render: () => <Show when={(() => { revision(); return projects.current() })()} keyed>{(controller) => <EditorRoute controller={controller} />}</Show> })
    const unregisterFiles = context.ui.slot({ append: "sidebar.content", render: (props) => <Show when={(() => { revision(); return projects.forSession(props.sessionID) })()} keyed fallback={<FilesToggle context={context} label="▸ Files" toggle={() => void projects.run(() => projects.toggleFiles())} />}>{(controller) => <SessionFiles controller={controller} sessionID={props.sessionID} />}</Show> })
    context.keymap.layer(() => { revision(); return { mode: "global", priority: 10, enabled: !projects.modal, commands: [
      { id: "oec.toggle", title: "OEC: toggle conversation/editor", group: "OEC", palette: true, bind: preferences.toggleBinding, slash: { name: "oec" }, run: () => projects.run(() => projects.toggle()) },
      { id: "oec.files", title: "OEC: expand/collapse session Files", group: "OEC", palette: true, bind: false, run: () => projects.run(() => projects.toggleFiles()) },
      { id: "oec.diff", title: "OEC: show/hide Diff", group: "OEC", palette: true, bind: preferences.diffBinding, run: () => projects.run(() => projects.toggleDiff()) },
      { id: "oec.clearDrafts", title: "OEC: delete stored drafts for this project", group: "OEC", palette: true, run: () => projects.run(async () => { await projects.current()?.clearStoredDrafts() }) },
    ] } })
    return async () => { unregisterFiles(); unregisterRoute(); stop(); await projects.dispose() }
  },
})
