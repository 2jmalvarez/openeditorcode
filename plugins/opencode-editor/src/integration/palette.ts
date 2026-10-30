import type { KeymapCommand } from "@opencode/plugin/tui/context"
import type { EditorProjects } from "./projects"
import { isEditable, hasPreview } from "../documents/workspace"
import { OEC_GROUP } from "./reference"

/** Context-owned layers expose their actions without claiming the chat's keys. */
export function paletteCommands(prefix: string, commands: KeymapCommand[], t: (source: string) => string = (source) => source): KeymapCommand[] {
  const labels: Record<string, string> = { up: "Previous row", down: "Next row", return: "Open selection / toggle folder", right: "Expand / open selection", left: "Collapse / parent folder", f5: "Refresh", escape: "Clear search / leave panel", "escape,tab": "Return focus", "shift+tab": "Focus Files", tab: "Next panel", "/": "Focus file search", "ctrl+e": "Toggle fuzzy/literal name search", "ctrl+f": "Toggle name/content search" }
  return commands.map((command) => ({
    ...command, id: command.id ?? `oec.${prefix}.${String(command.bind).replace(/[^a-z0-9]+/g, ".")}`,
    title: command.title ? t(command.title) : `${t(labels[String(command.bind)] ?? String(command.bind))} · ${t(prefix === "diff.tree" ? "Diff" : "Files")}`,
    group: OEC_GROUP, palette: true,
  }))
}

/** Palette access from conversation; do not capture the host prompt's shortcuts. */
export function conversationCommands(projects: EditorProjects): KeymapCommand[] {
  const current = () => projects.current()
  const file = () => isEditable(current()?.workspace.active)
  const action = (id: string, title: string, run: () => Promise<unknown>, enabled: () => boolean): KeymapCommand => ({ id, title: projects.t(title), group: OEC_GROUP, palette: true, bind: false, enabled, run: () => projects.run(run) })
  return [
    action("oec.conversation.save", "Save file · Ctrl+S", async () => { await current()?.save() }, file),
    action("oec.conversation.close", "Close tab · Ctrl+W", async () => { const controller = current(); if (controller?.workspace.activePath) await controller.close(controller.workspace.activePath) }, () => Boolean(current()?.workspace.active)),
    action("oec.conversation.diff.edit", "Edit changed file · F4", async () => { await current()?.alternateView() }, () => current()?.workspace.active?.kind === "diff"),
    action("oec.conversation.markdown.edit", "Edit Markdown / SVG or toggle preview · F4", async () => { const controller = current(); await controller?.inEditor(() => controller.alternateView()) }, () => file() && hasPreview(current()?.workspace.active?.path ?? "")),
    action("oec.conversation.reload", "Reload file from disk", async () => { await current()?.reload() }, file),
    action("oec.conversation.next", "Next document · Shift+Tab", async () => { const controller = current(); if (!controller) return; const workspace = controller.workspace; const next = workspace.documents[(workspace.documents.findIndex((document) => document.path === workspace.activePath) + 1) % workspace.documents.length]; if (next) controller.activate(next.path) }, () => Boolean(current()?.workspace.documents.length)),
    action("oec.conversation.find", "Find in file · Ctrl+F", async () => { const controller = current(); await controller?.inEditor(() => { controller.workspace.setSource(); controller.editorAction?.("find") }) }, file),
    action("oec.conversation.wrap", "Toggle line wrap · Ctrl+L", async () => { current()?.toggleWrap() }, file),
    action("oec.conversation.focus", "Focus editor / Files / Diff · Tab", async () => { const controller = current(); await controller?.inEditor(() => controller.editorAction?.("focus")) }, () => Boolean(current())),
  ]
}
