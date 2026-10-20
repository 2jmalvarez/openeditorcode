import type { KeymapCommand } from "@opencode/plugin/tui/context"
import type { EditorProjects } from "./projects"
import { isEditable, isMarkdown } from "../documents/workspace"
import { OEC_GROUP } from "./reference"

/** Palette access from conversation; do not capture the host prompt's shortcuts. */
export function conversationCommands(projects: EditorProjects): KeymapCommand[] {
  const current = () => projects.current()
  const file = () => isEditable(current()?.workspace.active)
  const action = (id: string, title: string, run: () => Promise<unknown>, enabled: () => boolean): KeymapCommand => ({ id, title, group: OEC_GROUP, palette: true, bind: false, enabled, run: () => projects.run(run) })
  return [
    action("oec.conversation.save", "Save file · Ctrl+S", async () => { await current()?.save() }, file),
    action("oec.conversation.close", "Close tab · Ctrl+W", async () => { const controller = current(); if (controller?.workspace.activePath) await controller.close(controller.workspace.activePath) }, () => Boolean(current()?.workspace.active)),
    action("oec.conversation.diff.edit", "Edit changed file · F4", async () => { await current()?.alternateView() }, () => current()?.workspace.active?.kind === "diff"),
    action("oec.conversation.markdown.edit", "Edit Markdown / toggle preview · F4", async () => { const controller = current(); await controller?.inEditor(() => controller.alternateView()) }, () => file() && isMarkdown(current()?.workspace.active?.path ?? "")),
    action("oec.conversation.find", "Find in file · Ctrl+F", async () => { const controller = current(); await controller?.inEditor(() => { controller.workspace.setSource(); controller.editorAction?.("find") }) }, file),
    action("oec.conversation.wrap", "Toggle line wrap · Ctrl+L", async () => { current()?.toggleWrap() }, file),
    action("oec.conversation.focus", "Focus editor / Files / Diff · Tab", async () => { const controller = current(); await controller?.inEditor(() => controller.editorAction?.("focus")) }, () => Boolean(current())),
  ]
}
