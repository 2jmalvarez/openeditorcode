import { expect, test } from "bun:test"
import { matchesBinding } from "../src/workbench/keybindings"

function key(name: string, modifiers: Partial<{ ctrl: boolean; shift: boolean; option: boolean; meta: boolean }> = {}) {
  return { name, ctrl: false, shift: false, option: false, meta: false, ...modifiers } as never
}

test("matches normalized configurable key chords", () => {
  expect(matchesBinding(key("return"), "enter")).toBe(true)
  expect(matchesBinding(key("f", { ctrl: true, option: true }), "ctrl+alt+f")).toBe(true)
  expect(matchesBinding(key("f", { ctrl: true }), "ctrl+alt+f")).toBe(false)
})
