/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal, Show } from "solid-js"
import { EditorProjects } from "./integration/projects"
import { parsePreferences } from "./integration/options"
import { EditorRoute } from "./workbench/EditorRoute"
import { SessionFiles } from "./explorer/SessionFiles"

export default Plugin.define({
  id: "oec.editor",
  setup(context) {
    const projects = new EditorProjects(context)
    const preferences = parsePreferences(context.options)
    const [revision, setRevision] = createSignal(0)
    const stop = projects.subscribe(() => setRevision((value) => value + 1))
    const unregisterRoute = context.ui.router.register({ name: "oec.editor", render: () => <Show when={(() => { revision(); return projects.current() })()} keyed>{(controller) => <EditorRoute controller={controller} />}</Show> })
    const unregisterFiles = context.ui.slot({ append: "sidebar.content", render: (props) => <Show when={(() => { revision(); return projects.forSession(props.sessionID) })()} keyed fallback={<text fg={context.theme.text.base} onMouseDown={() => void projects.run(() => projects.toggleFiles())}>OEC · Show project files (palette)</text>}>{(controller) => <SessionFiles controller={controller} sessionID={props.sessionID} />}</Show> })
    context.keymap.layer(() => { revision(); return { mode: "global", priority: 10, enabled: !projects.modal, commands: [
      { id: "oec.toggle", title: "OEC: toggle conversation/editor", group: "OEC", palette: true, bind: preferences.toggleBinding, slash: { name: "oec" }, run: () => projects.run(() => projects.toggle()) },
      { id: "oec.files", title: "OEC: show/hide session files", group: "OEC", palette: true, bind: preferences.filesBinding, run: () => projects.run(() => projects.toggleFiles()) },
    ] } })
    return async () => { unregisterFiles(); unregisterRoute(); stop(); await projects.dispose() }
  },
})
