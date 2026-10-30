import { expect, test } from "bun:test"
import type { TextareaRenderable } from "@opentui/core"
import type { EditorController } from "../src/integration/controller"
import { editorCommands } from "../src/workbench/useKeyboardShortcuts"
import { createTranslator } from "../src/localization"

test("editor commands own Enter, copy only selected text, and leave explorer/search keys alone", () => {
  let focus: "editor" | "explorer" = "editor"
  let searching = false
  let selected = "chosen text"
  let newlines = 0
  let accepted = 0
  let copied = ""
  const controller = { t: createTranslator("en"), workspace: { active: {} }, context: { renderer: { copyToClipboardOSC52: (text: string) => { copied = text } } } } as unknown as EditorController
  const editor = { newLine: () => { newlines++ }, getSelectedText: () => selected } as unknown as TextareaRenderable
  const commands = editorCommands({ controller, focused: () => focus, editor: () => editor, findOpen: () => searching,
    openFind: () => {}, closeFind: () => {}, moveFind: () => {}, acceptFind: () => { accepted++ }, cycleFocus: () => {}, focusEditor: () => {}, focusExplorer: () => {},
  })
  const enabled = (command: (typeof commands)[number]) => typeof command.enabled === "function" ? command.enabled() : command.enabled !== false
  const press = (bind: string) => { for (const command of commands.filter((command) => command.bind === bind && enabled(command))) command.run() }
  press("return")
  expect(newlines).toBe(1)
  press("ctrl+c")
  expect(copied).toBe("chosen text")
  selected = ""
  copied = "untouched"
  press("ctrl+c")
  expect(copied).toBe("untouched")
  focus = "explorer"
  press("return")
  expect(newlines).toBe(1)
  expect(commands.filter((command) => command.bind === "ctrl+shift+right" && enabled(command))).toHaveLength(0)
  focus = "editor"
  searching = true
  press("return")
  expect(newlines).toBe(1)
  expect(accepted).toBe(1)
  for (const bind of ["shift+alt+up", "alt+down", "ctrl+a", "ctrl+d", "pageup", "shift+pagedown"]) {
    expect(commands.filter((command) => command.bind === bind && enabled(command))).toHaveLength(0)
  }
})
