import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildFileIndex } from "../src/search/file-index"
import { createGitignore } from "../src/explorer/gitignore"

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

test("accepts session exclusion rules instead of the project gitignore", async () => {
  await mkdir(join(root, "ignored"))
  await mkdir(join(root, "visible"))
  await writeFile(join(root, ".gitignore"), "ignored/\n", "utf8")
  await writeFile(join(root, "ignored", "inside.ts"), "ignored", "utf8")
  await writeFile(join(root, "visible", "inside.ts"), "visible", "utf8")

  const defaultIndex = await buildFileIndex(root)
  const sessionIndex = await buildFileIndex(root, { rules: createGitignore(["visible/"]) })

  expect(defaultIndex.items.some((item) => item.path === join(root, "ignored", "inside.ts"))).toBe(false)
  expect(sessionIndex.items.some((item) => item.path === join(root, "ignored", "inside.ts"))).toBe(true)
  expect(sessionIndex.items.some((item) => item.path === join(root, "visible", "inside.ts"))).toBe(false)
})
