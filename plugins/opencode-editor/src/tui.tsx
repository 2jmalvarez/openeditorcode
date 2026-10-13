/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { EditorController } from "./integration/controller"
import { parseOptions } from "./integration/options"
import { EditorRoute } from "./workbench/EditorRoute"
import { SessionFiles } from "./explorer/SessionFiles"

export default Plugin.define({
  id: "oec.editor",
  setup(context) {
    const controller = new EditorController(context, parseOptions(context.options))
    const [revision, setRevision] = createSignal(0)
    const stop = controller.subscribe(() => setRevision((value) => value + 1))
    const unregisterRoute = context.ui.router.register({ name: "oec.editor", render: () => <EditorRoute controller={controller} /> })
    const unregisterFiles = context.ui.slot({ append: "sidebar.content", render: (props) => <SessionFiles controller={controller} sessionID={props.sessionID} /> })
    context.keymap.layer(() => { revision(); return { mode: "global", priority: 10, enabled: !controller.modal, commands: [
      { id: "oec.toggle", title: "OEC: toggle conversation/editor", group: "OEC", palette: true, bind: controller.options.toggleBinding, slash: { name: "oec" }, run: () => controller.run(() => controller.toggle()) },
      { id: "oec.files", title: "OEC: show/hide session files", group: "OEC", palette: true, bind: controller.options.filesBinding, run: () => controller.run(() => controller.toggleFiles()) },
    ] } })
    return async () => { unregisterFiles(); unregisterRoute(); stop(); await controller.dispose() }
  },
})
