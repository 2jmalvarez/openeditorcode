import type { KeymapCommand } from "@opencode/plugin/tui/context"
import type { TextareaRenderable } from "@opentui/core"
import { readClipboard } from "../../../../src/editor/clipboard"
import type { EditorController } from "../integration/controller"
import { duplicateLine, insertLine, moveLine, movePage, pasteClipboard, selectWord } from "./editor-actions"
import { isEditable, isMarkdown } from "../documents/workspace"
import { nativeCommands } from "./native-shortcuts"
import { OEC_GROUP } from "../integration/reference"

type Props = {
  controller: EditorController
  focused: () => "editor" | "explorer" | "search" | "panels"
  editor: () => TextareaRenderable | undefined
  findOpen: () => boolean
  openFind: () => void
  closeFind: () => void
  moveFind: (direction: number) => void
  acceptFind: () => void
  cycleFocus: () => void
  focusEditor: () => void
  focusExplorer: () => void
}

/** The plugin's only editor key router. Private input mode prevents session actions from handling editor keys. */
export function editorCommands(props: Props): KeymapCommand[] {
  const controller = props.controller
  const editable = () => isEditable(controller.workspace.active)
  const editorEnabled = () => props.focused() === "editor" && !props.findOpen() && editable() && controller.workspace.active?.view !== "preview"
  const edit = (bind: string, action: (editor: TextareaRenderable) => void): KeymapCommand => ({ bind, enabled: editorEnabled, run: () => { const editor = props.editor(); if (editor) action(editor) } })
  const commands: KeymapCommand[] = [
    { id: "oec.search.open", title: "OEC: open selected file search result", palette: true, bind: "return", enabled: () => props.focused() === "search", run: () => controller.run(async () => {
      const search = controller.fileSearch
      const item = search.rows[search.selected]
      if (item?.directory) search.toggle()
      else if (item) await controller.open(item.path)
    }) },
    { bind: "up", enabled: () => props.focused() === "search", run: () => controller.fileSearch.move(-1) },
    { bind: "down", enabled: () => props.focused() === "search", run: () => controller.fileSearch.move(1) },
    { id: "oec.save", title: "OEC: save file", palette: true, bind: "ctrl+s", enabled: editable, run: () => controller.run(() => controller.save()) },
    { id: "oec.view", title: "Edit changed file", palette: true, bind: "f4", enabled: () => !props.findOpen() && controller.workspace.active?.kind === "diff", run: () => controller.run(() => controller.alternateView()) },
    { id: "oec.markdown.view", title: "Edit Markdown / toggle preview", palette: true, bind: "f4", enabled: () => !props.findOpen() && editable() && isMarkdown(controller.workspace.active?.path ?? ""), run: () => controller.run(() => controller.alternateView()) },
    { id: "oec.close", title: "OEC: close file", palette: true, bind: "ctrl+w", enabled: () => Boolean(controller.workspace.active), run: () => controller.run(async () => { const path = controller.workspace.activePath; if (path) await controller.close(path) }) },
    { id: "oec.reload", title: "OEC: reload file from disk", palette: true, bind: false, enabled: editable, run: () => controller.run(() => controller.reload()) },
    { id: "oec.find", title: "OEC: find in file", palette: true, bind: "ctrl+f", enabled: editorEnabled, run: props.openFind },
    { id: "oec.wrap", title: "OEC: toggle line wrap", palette: true, bind: "ctrl+l", enabled: editorEnabled, run: () => controller.toggleWrap() },
    { id: "oec.document.next", title: "OEC: next file", palette: true, bind: "shift+tab", run: () => {
      const workspace = controller.workspace
      const index = workspace.documents.findIndex((document) => document.path === workspace.activePath)
      const next = workspace.documents[(index + 1) % workspace.documents.length]
      if (next) controller.activate(next.path)
    } },
    { id: "oec.focus", title: "OEC: switch editor/files focus", palette: true, bind: "tab", enabled: () => !props.findOpen(), run: props.cycleFocus },
    edit("return", (editor) => { editor.newLine() }),
    edit("shift+return", (editor) => { editor.newLine() }),
    edit("ctrl+return", (editor) => insertLine(editor, false)),
    edit("ctrl+shift+return", (editor) => insertLine(editor, true)),
    edit("shift+alt+up", (editor) => duplicateLine(editor, -1)),
    edit("shift+alt+down", (editor) => duplicateLine(editor, 1)),
    edit("alt+up", (editor) => moveLine(editor, -1)),
    edit("alt+down", (editor) => moveLine(editor, 1)),
    edit("ctrl+shift+k", (editor) => { editor.clearSelection(); editor.deleteLine() }),
    edit("ctrl+d", selectWord),
    { id: "oec.select.all", title: "OEC: select all file contents", palette: true, ...edit("ctrl+a", (editor) => { editor.selectAll() }) },
    edit("ctrl+home", (editor) => { editor.gotoBufferHome() }),
    edit("ctrl+end", (editor) => { editor.gotoBufferEnd() }),
    edit("home", (editor) => editor.gotoLineHome()),
    edit("end", (editor) => editor.gotoLineEnd()),
    edit("shift+home", (editor) => editor.gotoLineHome({ select: true })),
    edit("shift+end", (editor) => editor.gotoLineEnd({ select: true })),
    edit("ctrl+shift+home", (editor) => { editor.gotoBufferHome({ select: true }) }),
    edit("ctrl+shift+end", (editor) => { editor.gotoBufferEnd({ select: true }) }),
    edit("ctrl+left", (editor) => { editor.moveWordBackward() }),
    edit("ctrl+right", (editor) => { editor.moveWordForward() }),
    edit("ctrl+shift+left", (editor) => { editor.moveWordBackward({ select: true }) }),
    edit("ctrl+shift+right", (editor) => { editor.moveWordForward({ select: true }) }),
    edit("pageup", (editor) => movePage(editor, -1)),
    edit("pagedown", (editor) => movePage(editor, 1)),
    edit("shift+pageup", (editor) => movePage(editor, -1, true)),
    edit("shift+pagedown", (editor) => movePage(editor, 1, true)),
    { bind: "ctrl+z", enabled: editorEnabled, run: () => { props.editor()?.undo() } },
    { bind: "ctrl+shift+z", enabled: editorEnabled, run: () => { props.editor()?.redo() } },
    { bind: "ctrl+c", enabled: editorEnabled, run: () => {
      const text = props.editor()?.getSelectedText()
      if (text) controller.context.renderer.copyToClipboardOSC52(text)
    } },
    { bind: "ctrl+v", enabled: editorEnabled, run: () => controller.run(async () => {
      const editor = props.editor()
      if (!editor) return
      const path = controller.workspace.activePath
      const version = controller.workspace.active?.version
      await pasteClipboard(editor, () => readClipboard({ preserveTrailingNewline: true }), () => props.editor() === editor && controller.workspace.activePath === path && controller.workspace.active?.version === version && !controller.modal && controller.context.keymap.mode.current() === "oec-editor" && editorEnabled())
    }) },
    { bind: "up", enabled: props.findOpen, run: () => props.moveFind(-1) },
    { bind: "down", enabled: props.findOpen, run: () => props.moveFind(1) },
    { bind: "return", enabled: props.findOpen, run: props.acceptFind },
    { bind: "escape", enabled: () => props.findOpen() || props.focused() === "explorer" || props.focused() === "search", run: () => {
      if (props.findOpen()) props.closeFind()
      else if (props.focused() === "search" && controller.fileSearch.query) { void controller.fileSearch.search(""); props.focusExplorer() }
      else props.focusEditor()
    } },
    { bind: "ctrl+e", enabled: () => props.focused() === "search", run: () => controller.toggleSearchMode() },
    { bind: "f5", enabled: editorEnabled, run: () => controller.run(async () => { await controller.workspace.checkExternal(); await controller.tree.refresh(); await controller.changes.refresh() }) },
  ]
  const labels: Record<string, string> = { "return": "insert newline", "shift+return": "insert newline (Shift)", "ctrl+return": "insert line below", "ctrl+shift+return": "insert line above", "shift+alt+up": "duplicate line above", "shift+alt+down": "duplicate line below", "alt+up": "move line up", "alt+down": "move line down", "ctrl+shift+k": "delete line", "ctrl+d": "select word", "ctrl+z": "undo", "ctrl+shift+z": "redo", "ctrl+c": "copy selection", "ctrl+v": "paste clipboard", "f5": "refresh editor and local Git" }
  Object.assign(labels, { "home": "Line start", "end": "Line end", "shift+home": "Select to line start", "shift+end": "Select to line end", "ctrl+home": "File start", "ctrl+end": "File end", "ctrl+shift+home": "Select to file start", "ctrl+shift+end": "Select to file end", "ctrl+left": "Previous word", "ctrl+right": "Next word", "ctrl+shift+left": "Select previous word", "ctrl+shift+right": "Select next word", "pageup": "Previous page", "pagedown": "Next page", "shift+pageup": "Select previous page", "shift+pagedown": "Select next page" })
  commands.push(...nativeCommands(props.editor, editorEnabled, new Set(commands.map((command) => String(command.bind)).filter((bind) => !["up", "down", "ctrl+e"].includes(bind)))))
  const seen = new Set<string>()
  return commands.map((original) => {
    const command: KeymapCommand = { ...original, run: (input, event) => {
      event?.preventDefault(); event?.stopPropagation()
      return original.run(input, event)
    } }
    if (command.id) return { ...command, title: command.title?.replace(/^OEC: /, ""), group: OEC_GROUP }
    const binding = String(command.bind)
    if (!labels[binding] || seen.has(binding)) return command
    seen.add(binding)
    return {
    ...command, id: `oec.editor.${String(command.bind).replace(/\+/g, ".")}`, title: labels[String(command.bind)], group: OEC_GROUP, palette: true,
    }
  })
}
