import type { ChangeRow } from "./tree"

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Virtualize terminal lines, while keeping selection and activation on logical rows. */
export function diffVisualRows(rows: readonly ChangeRow[], width: number, wrap: boolean, unavailable = "Branch unavailable") {
  return rows.flatMap((row, index) => {
    const label = row.repository ? `${row.expanded ? "▾" : "▸"} ${row.changedFiles ? `(${row.changedFiles}) ` : ""}${row.name}` : ""
    const lines: { label: string; branch: string }[] = []
    const branch = row.repository ? row.repository.branch || unavailable : ""
    if (row.repository && wrap) {
      const available = Math.max(1, width - row.depth - 2)
      let line = ""
      for (const { segment: character } of graphemes.segment(label)) {
        if (line && Bun.stringWidth(line + character) > available) { lines.push({ label: line, branch: "" }); line = "" }
        line += character
      }
      lines.push({ label: line, branch: "" })
      let tail = lines[lines.length - 1]!
      let remaining = Math.max(0, width - row.depth - 4 - Bun.stringWidth(tail.label))
      for (const { segment: character } of graphemes.segment(branch)) {
        const size = Bun.stringWidth(character)
        if (size > remaining) {
          tail = { label: "", branch: "" }
          lines.push(tail)
          remaining = Math.max(1, width - row.depth - 4)
        }
        tail.branch += character
        remaining -= size
      }
    } else lines.push({ label, branch })
    return lines.map((line, part) => ({ row, index, ...line, part, last: part === lines.length - 1 }))
  })
}
