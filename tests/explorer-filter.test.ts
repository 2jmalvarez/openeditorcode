import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createRoot } from "solid-js"
import { filteredTree } from "../src/explorer/filter-tree"
import { buildFileIndex } from "../src/search/file-index"
import { filterFilesByContent } from "../src/search/content-files"
import { useSearch } from "../src/search/useSearch"

let root = ""
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-filter-"))
  await mkdir(join(root, "src", "nested"), { recursive: true })
  await writeFile(join(root, "src", "nested", "one.ts"), "Unique phrase\nUnique phrase")
  await writeFile(join(root, "two.txt"), "different")
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test("builds a deduplicated hierarchical tree and supports independent collapse", () => {
  const files = [{ path: join(root, "src", "nested", "one.ts") }, { path: join(root, "src", "two.ts") }]
  expect(filteredTree(root, files).map(({ name, depth }) => [name, depth])).toEqual([
    ["src", 0], ["nested", 1], ["one.ts", 2], ["two.ts", 1],
  ])
  expect(filteredTree(root, files, new Set([join(root, "src")])).map((row) => row.name)).toEqual(["src"])
  expect(filteredTree(root, [])).toEqual([])
})

test("simple content search returns each file once, ignoring case and unsafe files", async () => {
  await writeFile(join(root, "binary.bin"), "Unique phrase\0")
  await writeFile(join(root, "huge.txt"), "Unique phrase" + "x".repeat(2 * 1024 * 1024))
  await writeFile(join(root, ".gitignore"), "ignored.txt\n")
  await writeFile(join(root, "ignored.txt"), "Unique phrase")
  const { items } = await buildFileIndex(root)
  expect((await filterFilesByContent(root, items, "UNIQUE PHRASE")).map((file) => file.name)).toEqual(["one.ts"])
  expect(await filterFilesByContent(root, items, "missing")).toEqual([])
  expect(await filterFilesByContent(root, items, "unique", () => false)).toEqual([])
})

test("switching modes reuses the query, and clearing invalidates pending content results", async () => {
  const state = createRoot((dispose) => ({ search: useSearch({ root, setStatus: () => {}, runActivity: async (_message, operation) => operation() }), dispose }))
  try {
    await state.search.updateFileQuery("one.ts")
    expect(state.search.fileResults().map((item) => item.name)).toEqual(["one.ts"])
    state.search.toggleFileSearchMode()
    expect(state.search.fileSearchMode()).toBe("content")
    expect(state.search.fileQuery()).toBe("one.ts")
    await state.search.updateFileQuery("unique phrase")
    expect(state.search.fileResults().map((item) => item.name)).toEqual(["one.ts"])
    const pending = state.search.updateFileQuery("unique")
    state.search.closeFileSearch()
    await pending
    expect(state.search.fileResults()).toEqual([])
    expect(state.search.fileSearching()).toBe(false)
    expect(state.search.fileQuery()).toBe("")
  } finally { state.dispose() }
})
