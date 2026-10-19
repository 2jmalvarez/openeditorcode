import type { KeymapCommand } from "@opencode/plugin/tui/context"
import type { TextareaRenderable } from "@opentui/core"
import { readClipboard } from "../../../../src/editor/clipboard"
import type { EditorController } from "../integration/controller"
import { duplicateLine, insertLine, moveLine, movePage, pasteClipboard, selectWord } from "./editor-actions"

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
  const editorEnabled = () => props.focused() === "editor" && !props.findOpen() && Boolean(controller.workspace.active)
  const edit = (bind: string, action: (editor: TextareaRenderable) => void): KeymapCommand => ({ bind, enabled: editorEnabled, run: () => { const editor = props.editor(); if (editor) action(editor) } })
  return [
    { id: "oec.save", title: "OEC: save file", palette: true, bind: "ctrl+s", enabled: () => Boolean(controller.workspace.active), run: () => controller.run(() => controller.save()) },
    { id: "oec.close", title: "OEC: close file", palette: true, bind: "ctrl+w", enabled: () => Boolean(controller.workspace.active), run: () => controller.run(async () => { const path = controller.workspace.activePath; if (path) await controller.close(path) }) },
    { id: "oec.reload", title: "OEC: reload file from disk", palette: true, bind: false, enabled: () => Boolean(controller.workspace.active), run: () => controller.run(() => controller.reload()) },
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
    { bind: "escape", enabled: () => props.findOpen() || props.focused() === "explorer", run: () => { if (props.findOpen()) props.closeFind(); else props.focusEditor() } },
    { bind: "f5", enabled: editorEnabled, run: () => controller.run(async () => { await controller.workspace.checkExternal(); await controller.tree.refresh() }) },
  ]
}
