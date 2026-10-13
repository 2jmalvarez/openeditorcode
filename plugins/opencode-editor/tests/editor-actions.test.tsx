/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import type { TextareaRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { duplicateLine, insertLine, moveLine, movePage, pasteClipboard, selectWord } from "../src/workbench/editor-actions"

test("line actions preserve undo and handle empty lines and file boundaries", async () => {
  let editor!: TextareaRenderable
  const setup = await testRender(() => <textarea ref={(value) => { editor = value }} initialValue="one\ntwo\nthree" width={50} height={8} focused />, { width: 50, height: 8 })
  try {
    await setup.renderOnce()
    editor.setCursor(1, 2)
    duplicateLine(editor, 1)
    expect(editor.plainText).toBe("one\ntwo\ntwo\nthree")
    expect(editor.logicalCursor.row).toBe(2)
    expect(editor.undo()).toBe(true)
    expect(editor.plainText).toBe("one\ntwo\nthree")
    editor.setCursor(1, 2)
    moveLine(editor, -1)
    expect(editor.plainText).toBe("two\none\nthree")
    expect(editor.logicalCursor.row).toBe(0)
    moveLine(editor, -1)
    expect(editor.plainText).toBe("two\none\nthree")
    insertLine(editor, true)
    expect(editor.plainText).toBe("\ntwo\none\nthree")
    expect(editor.logicalCursor.row).toBe(0)
    editor.setCursor(3, 2)
    insertLine(editor, false)
    expect(editor.plainText).toBe("\ntwo\none\nthree\n")
    expect(editor.logicalCursor.row).toBe(4)
    duplicateLine(editor, -1)
    expect(editor.plainText).toBe("\ntwo\none\nthree\n\n")
  } finally { setup.renderer.destroy() }
})

test("word selection, paste replacement, and page selection use native buffer semantics", async () => {
  let editor!: TextareaRenderable
  const setup = await testRender(() => <textarea ref={(value) => { editor = value }} initialValue="const café = 1;" width={50} height={8} focused />, { width: 50, height: 8 })
  try {
    await setup.renderOnce()
    editor.setCursor(0, 8)
    selectWord(editor)
    expect(editor.getSelectedText()).toBe("café")
    editor.insertText("replacement\n")
    expect(editor.plainText).toBe("const replacement\n = 1;")
    editor.setText(Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n"))
    editor.setCursor(0, 2)
    movePage(editor, 1)
    expect(editor.logicalCursor.row).toBe(7)
    movePage(editor, 1, true)
    expect(editor.logicalCursor.row).toBe(14)
    expect(editor.getSelectedText()).toContain("line 8")
    editor.clearSelection()
    movePage(editor, -1)
    expect(editor.logicalCursor.row).toBe(7)
  } finally { setup.renderer.destroy() }
})

test("clipboard paste replaces selection, preserves trailing newline, and cancels stale reads", async () => {
  let editor!: TextareaRenderable
  const setup = await testRender(() => <textarea ref={(value) => { editor = value }} initialValue="old text" width={50} height={8} focused />, { width: 50, height: 8 })
  try {
    await setup.renderOnce()
    editor.selectAll()
    expect(await pasteClipboard(editor, async () => "new\r\nlines\r\n", () => true)).toBe(true)
    expect(editor.plainText).toBe("new\nlines\n")
    let finish!: (text: string) => void
    const pending = pasteClipboard(editor, () => new Promise<string>((resolve) => { finish = resolve }), () => true)
    editor.gotoBufferHome()
    finish("wrong place")
    expect(await pending).toBe(false)
    expect(editor.plainText).toBe("new\nlines\n")
    expect(await pasteClipboard(editor, async () => "wrong document", () => false)).toBe(false)
    expect(editor.plainText).toBe("new\nlines\n")
  } finally { setup.renderer.destroy() }
})
