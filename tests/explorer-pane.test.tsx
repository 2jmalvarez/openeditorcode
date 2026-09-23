/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { ExplorerPane } from "../src/explorer/ExplorerPane"
import type { TreeItem } from "../src/explorer/tree"
import { visibleName } from "../src/explorer/ScrollingName"
import { createSignal } from "solid-js"

test("scrolls a selected name across terminal columns without splitting wide characters", () => {
  expect(visibleName("prefix-界-ending", 8, 0)).toBe("prefix-")
  expect(visibleName("prefix-界-ending", 8, 9)).toBe("fix-界-e")
  expect(visibleName("prefix-界-ending", 8, 15)).toBe("-ending")
  expect(visibleName("short", 8, 100)).toBe("short")
})

test("keeps calculated line counts visible while a long selected file name moves", async () => {
  const [selected, setSelected] = createSignal(0)
  const tree: TreeItem[] = ["very-long-filename-with-a-readable-tail.ts", "second-file.ts"].map((name) => ({ path: name, name, depth: 0, directory: false, expanded: false, ignored: false }))
  const setup = await testRender(() => <ExplorerPane root="." active={() => true} tree={() => tree} selected={selected}
    filePath={() => undefined} lineCounts={() => ({ [tree[0]!.path]: 123456, [tree[1]!.path]: 42 })} setScroll={() => {}}
    onActivate={() => {}} fileSearchOpen={() => false} fileQuery={() => ""} fileResults={() => []}
    fileSearchIndex={() => 0} onFileQuery={() => {}} onFileActivate={() => {}}
    massiveFilesOpen={() => false} onToggleMassiveFiles={() => {}} width={() => 28}
  />, { width: 28, height: 10 })
  try {
    await setup.renderOnce()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("123456")
    await Bun.sleep(1800)
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("123456")
    expect(frame).toContain("42")
    expect(frame).toContain("long-")
    setSelected(1)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("very-long-")
  } finally { setup.renderer.destroy() }
})

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
    onFileActivate={() => {}} massiveFilesOpen={() => false} onToggleMassiveFiles={() => {}} width={() => 40}
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
