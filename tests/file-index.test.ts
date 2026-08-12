import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildFileIndex } from "../src/search/file-index"

let root = ""

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-index-"))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

test("reports a bounded project index as truncated", async () => {
  await Promise.all(["a.ts", "b.ts", "c.ts", "d.ts"].map((name) => writeFile(join(root, name), name, "utf8")))
  const index = await buildFileIndex(root, { limit: 3 })

  expect(index.truncated).toBe(true)
  expect(index.items).toHaveLength(3)
  expect(index.items.map((item) => item.name)).toEqual(["a.ts", "b.ts", "c.ts"])
})

test("does not report a small index as truncated", async () => {
  await writeFile(join(root, "only.ts"), "content", "utf8")
  const index = await buildFileIndex(root, { limit: 3 })

  expect(index).toEqual({
    items: [{ path: join(root, "only.ts"), name: "only.ts", directory: false }],
    truncated: false,
  })
})
