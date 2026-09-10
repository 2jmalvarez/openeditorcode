/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { ExplorerPane } from "../src/explorer/ExplorerPane"
import type { TreeItem } from "../src/explorer/tree"

test("aligns explorer names across icon widths and preserves indentation and counts", async () => {
  const tree: TreeItem[] = [0, 1, 2].flatMap((depth) =>
    ["closed", "opened", "config.json", "code.ts", "script.sh", "notes.md", "other.bin"].map((name) => ({
      path: `${depth}/${name}`, name: `${depth}-${name}`, depth,
      directory: name === "closed" || name === "opened", expanded: name === "opened", ignored: false,
    })),
  )
  const counts = Object.fromEntries(tree.filter((item) => !item.directory).map((item) => [item.path, 123]))
  const setup = await testRender(() => <ExplorerPane
    root="." active={() => true} tree={() => tree} selected={() => 0}
    filePath={() => undefined} lineCounts={() => counts} setScroll={() => {}}
    onActivate={() => {}} fileSearchOpen={() => false} fileQuery={() => ""}
    fileResults={() => []} fileSearchIndex={() => 0} onFileQuery={() => {}}
    onFileActivate={() => {}} width={() => 40}
  />, { width: 40, height: 28 })
  try {
    await setup.renderOnce()
    await setup.renderOnce()
    const lines = setup.captureCharFrame().split("\n")
    const countColumns: number[] = []
    for (const item of tree) {
      const line = lines.find((line) => line.includes(item.name))
      expect(line).toBeDefined()
      expect(Bun.stringWidth(line!.slice(0, line!.indexOf(item.name)))).toBe(4 + item.depth)
      if (!item.directory) {
        expect(line).toContain("123")
        countColumns.push(Bun.stringWidth(line!.slice(0, line!.indexOf("123"))))
      } else {
        expect(line).not.toContain("123")
      }
    }
    expect(new Set(countColumns).size).toBe(1)
  } finally {
    setup.renderer.destroy()
  }
})
