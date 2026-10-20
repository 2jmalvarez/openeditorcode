import { defaultTextareaKeyBindings, type TextareaRenderable } from "@opentui/core"
import type { KeymapCommand } from "@opencode/plugin/tui/context"

const actions: Record<string, { title: string; run: (editor: TextareaRenderable) => unknown }> = {
  "move-left": { title: "Move cursor left", run: (e) => e.moveCursorLeft() },
  "move-right": { title: "Move cursor right", run: (e) => e.moveCursorRight() },
  "move-up": { title: "Move cursor up", run: (e) => e.moveCursorUp() },
  "move-down": { title: "Move cursor down", run: (e) => e.moveCursorDown() },
  "select-left": { title: "Select left", run: (e) => e.moveCursorLeft({ select: true }) },
  "select-right": { title: "Select right", run: (e) => e.moveCursorRight({ select: true }) },
  "select-up": { title: "Select up", run: (e) => e.moveCursorUp({ select: true }) },
  "select-down": { title: "Select down", run: (e) => e.moveCursorDown({ select: true }) },
  "buffer-home": { title: "File start", run: (e) => e.gotoBufferHome() },
  "buffer-end": { title: "File end", run: (e) => e.gotoBufferEnd() },
  "select-buffer-home": { title: "Select to file start", run: (e) => e.gotoBufferHome({ select: true }) },
  "select-buffer-end": { title: "Select to file end", run: (e) => e.gotoBufferEnd({ select: true }) },
  "line-home": { title: "Line start", run: (e) => e.gotoLineHome() },
  "line-end": { title: "Line end", run: (e) => e.gotoLineEnd() },
  "select-line-home": { title: "Select to line start", run: (e) => e.gotoLineHome({ select: true }) },
  "select-line-end": { title: "Select to line end", run: (e) => e.gotoLineEnd({ select: true }) },
  "visual-line-home": { title: "Visual line start", run: (e) => e.gotoVisualLineHome() },
  "visual-line-end": { title: "Visual line end", run: (e) => e.gotoVisualLineEnd() },
  "select-visual-line-home": { title: "Select to visual line start", run: (e) => e.gotoVisualLineHome({ select: true }) },
  "select-visual-line-end": { title: "Select to visual line end", run: (e) => e.gotoVisualLineEnd({ select: true }) },
  "word-forward": { title: "Next word", run: (e) => e.moveWordForward() },
  "word-backward": { title: "Previous word", run: (e) => e.moveWordBackward() },
  "select-word-forward": { title: "Select next word", run: (e) => e.moveWordForward({ select: true }) },
  "select-word-backward": { title: "Select previous word", run: (e) => e.moveWordBackward({ select: true }) },
  "delete-word-forward": { title: "Delete next word", run: (e) => e.deleteWordForward() },
  "delete-word-backward": { title: "Delete previous word", run: (e) => e.deleteWordBackward() },
  "delete-line": { title: "Delete line", run: (e) => e.deleteLine() },
  "delete-to-line-end": { title: "Delete to line end", run: (e) => e.deleteToLineEnd() },
  "delete-to-line-start": { title: "Delete to line start", run: (e) => e.deleteToLineStart() },
  "backspace": { title: "Delete previous character", run: (e) => e.deleteCharBackward() },
  "delete": { title: "Delete next character", run: (e) => e.deleteChar() },
  "newline": { title: "Insert newline", run: (e) => e.newLine() },
  "undo": { title: "Undo", run: (e) => e.undo() },
  "redo": { title: "Redo", run: (e) => e.redo() },
  "select-all": { title: "Select all file contents", run: (e) => e.selectAll() },
}

export const nativeShortcuts = defaultTextareaKeyBindings.flatMap((binding) => {
  const action = actions[binding.action]
  if (!action) return [] // Textarea submit has no editor action.
  const bind = [binding.ctrl && "ctrl", binding.meta && "alt", binding.super && "super", binding.shift && "shift", binding.name].filter(Boolean).join("+")
  return [{ bind, ...action }]
})

export function nativeCommands(editor: () => TextareaRenderable | undefined, enabled: () => boolean, reserved: ReadonlySet<string>): KeymapCommand[] {
  return nativeShortcuts.filter((shortcut) => !reserved.has(shortcut.bind)).map((shortcut) => ({
    id: `oec.native.${shortcut.bind}`, title: shortcut.title, bind: shortcut.bind, palette: true, enabled,
    run: () => { const value = editor(); if (value) shortcut.run(value) },
  }))
}
