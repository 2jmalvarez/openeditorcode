import type { TextareaRenderable } from "@opentui/core"

export function duplicateLine(editor: TextareaRenderable, direction: -1 | 1) {
  const { row, col } = editor.logicalCursor
  const lines = editor.plainText.split("\n")
  lines.splice(direction < 0 ? row : row + 1, 0, lines[row] ?? "")
  editor.clearSelection()
  editor.replaceText(lines.join("\n"))
  editor.setCursor(direction < 0 ? row : row + 1, col)
}

export function moveLine(editor: TextareaRenderable, direction: -1 | 1) {
  const { row, col } = editor.logicalCursor
  const lines = editor.plainText.split("\n")
  const target = row + direction
  if (target < 0 || target >= lines.length) return
  ;[lines[row], lines[target]] = [lines[target]!, lines[row]!]
  editor.clearSelection()
  editor.replaceText(lines.join("\n"))
  editor.setCursor(target, col)
}

export function insertLine(editor: TextareaRenderable, above: boolean) {
  editor.clearSelection()
  if (above) { editor.gotoLineHome(); editor.newLine(); editor.moveCursorUp() }
  else { editor.gotoLineEnd(); editor.newLine() }
}

export function movePage(editor: TextareaRenderable, direction: -1 | 1, select = false) {
  const move = direction < 0 ? () => editor.moveCursorUp({ select }) : () => editor.moveCursorDown({ select })
  for (let remaining = Math.max(1, editor.height - 1); remaining > 0 && move(); remaining--) {}
}

export async function pasteClipboard(editor: TextareaRenderable, read: () => Promise<string>, current: () => boolean) {
  const cursor = editor.cursorOffset
  const selection = JSON.stringify(editor.getSelection())
  const text = await read()
  if (!text || editor.isDestroyed || !current() || editor.cursorOffset !== cursor || JSON.stringify(editor.getSelection()) !== selection) return false
  editor.insertText(text.replace(/\r\n?/g, "\n"))
  return true
}

/** Select one word, not multiple cursors. Native cursor moves retain Unicode display-column semantics. */
export function selectWord(editor: TextareaRenderable) {
  const { row, col } = editor.logicalCursor
  const characters = Array.from(editor.plainText.split("\n")[row] ?? "")
  let index = 0
  let column = 0
  while (index < characters.length && column < col) column += Bun.stringWidth(characters[index++]!)
  const word = (character: string | undefined) => Boolean(character && /[\p{L}\p{N}_$]/u.test(character))
  if (!word(characters[index]) && word(characters[index - 1])) index--
  if (!word(characters[index])) return
  let start = index
  let end = index + 1
  while (word(characters[start - 1])) start--
  while (word(characters[end])) end++
  editor.clearSelection()
  editor.setCursor(row, Bun.stringWidth(characters.slice(0, start).join("")))
  for (let offset = start; offset < end; offset++) editor.moveCursorRight({ select: true })
}
