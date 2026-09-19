import { expect, test } from "bun:test"
import { duplicateCurrentLine } from "../src/editor/useEditor"
import { matchesBinding } from "../src/workbench/keybindings"

function key(name: string, modifiers: Partial<{ ctrl: boolean; shift: boolean; option: boolean; meta: boolean }> = {}) {
  return { name, ctrl: false, shift: false, option: false, meta: false, ...modifiers } as never
}

test("matches normalized configurable key chords", () => {
  expect(matchesBinding(key("return"), "enter")).toBe(true)
  expect(matchesBinding(key("f", { ctrl: true, option: true }), "ctrl+alt+f")).toBe(true)
  expect(matchesBinding(key("f", { ctrl: true }), "ctrl+alt+f")).toBe(false)
  expect(matchesBinding(key("down", { shift: true, option: true }), "alt+shift+down")).toBe(true)
  expect(matchesBinding(key("up", { shift: true, option: true }), "alt+shift+up")).toBe(true)
})

test("duplicates the current line above or below while preserving line endings", () => {
  expect(duplicateCurrentLine("one\r\ntwo\r\nthree", 1, "above")).toEqual({ text: "one\r\ntwo\r\ntwo\r\nthree", row: 1 })
  expect(duplicateCurrentLine("one\ntwo\nthree", 1, "below")).toEqual({ text: "one\ntwo\ntwo\nthree", row: 2 })
  expect(duplicateCurrentLine("one", 0, "below")).toEqual({ text: "one\none", row: 1 })
})
