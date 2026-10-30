import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildFileIndex } from "../src/search/file-index"
import { createGitignore } from "../src/explorer/gitignore"
import { descendantDirectories } from "../src/explorer/tree"
import { countProjectLines, sortMassiveFiles } from "../src/search/project-search"

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

test("finds all descendant directories while skipping Git metadata", async () => {
  await mkdir(join(root, "src", "nested"), { recursive: true })
  await mkdir(join(root, ".git", "objects"), { recursive: true })

  expect(await descendantDirectories(root)).toEqual(new Set([root, join(root, "src"), join(root, "src", "nested")]))
})

test("respects gitignores in sibling projects when the workspace has none", async () => {
  for (const project of ["app", "site"]) {
    await mkdir(join(root, project, "node_modules", "dependency"), { recursive: true })
    await writeFile(join(root, project, ".gitignore"), "node_modules/\n", "utf8")
    await writeFile(join(root, project, "node_modules", "dependency", "large.js"), "ignored\n".repeat(100), "utf8")
    await writeFile(join(root, project, "main.ts"), "visible", "utf8")
  }

  const index = await buildFileIndex(root)

  expect(index.items.some((item) => item.name === "node_modules" || item.name === "large.js")).toBe(false)
  expect(index.items.filter((item) => item.name === "main.ts")).toHaveLength(2)
  const summary = await countProjectLines(root, index.items)
  const massiveFiles = sortMassiveFiles(index.items, summary.byPath)
  expect(massiveFiles.some((item) => item.name === "large.js")).toBe(false)
  expect(massiveFiles.filter((item) => item.name === "main.ts")).toHaveLength(2)
})

test("inherits parent rules and allows nested exceptions without leaking to siblings", async () => {
  await mkdir(join(root, "app", "nested"), { recursive: true })
  await mkdir(join(root, "sibling"))
  await writeFile(join(root, ".gitignore"), "*.log\n*.tmp\n", "utf8")
  await writeFile(join(root, "app", ".gitignore"), "!keep.log\n/local.txt\n", "utf8")
  await writeFile(join(root, "app", "nested", ".gitignore"), "keep.log\n", "utf8")
  const paths = ["app/keep.log", "app/drop.log", "app/drop.tmp", "app/local.txt", "app/nested/local.txt", "app/nested/keep.log", "sibling/keep.log", "sibling/local.txt"]
  await Promise.all(paths.map((path) => writeFile(join(root, path), "content", "utf8")))

  const index = await buildFileIndex(root)
  const indexed = new Set(index.items.map((item) => item.path))

  for (const path of ["app/keep.log", "app/nested/local.txt", "sibling/local.txt"]) expect(indexed.has(join(root, path))).toBe(true)
  for (const path of ["app/drop.log", "app/drop.tmp", "app/local.txt", "app/nested/keep.log", "sibling/keep.log"]) expect(indexed.has(join(root, path))).toBe(false)
})

test("does not descend into ignored directories even if their gitignore would reinclude files", async () => {
  await mkdir(join(root, "ignored"))
  await writeFile(join(root, ".gitignore"), "ignored/\n", "utf8")
  await writeFile(join(root, "ignored", ".gitignore"), "!keep.ts\n", "utf8")
  await writeFile(join(root, "ignored", "keep.ts"), "ignored", "utf8")

  const index = await buildFileIndex(root)

  expect(index.items.some((item) => item.name === "ignored" || item.name === "keep.ts")).toBe(false)
})

test("explicit session rules also replace nested gitignore rules", async () => {
  await mkdir(join(root, "app"))
  await writeFile(join(root, "app", ".gitignore"), "hidden.ts\n", "utf8")
  await writeFile(join(root, "app", "hidden.ts"), "content", "utf8")

  const index = await buildFileIndex(root, { rules: createGitignore([]) })

  expect(index.items.some((item) => item.name === "hidden.ts")).toBe(true)
})

test("prunes ignored nested dependencies before reaching the index limit", async () => {
  await mkdir(join(root, "app", "node_modules"), { recursive: true })
  await writeFile(join(root, "app", ".gitignore"), "node_modules/\n", "utf8")
  await writeFile(join(root, "app", "main.ts"), "content", "utf8")
  await Promise.all(Array.from({ length: 20 }, (_, index) => writeFile(join(root, "app", "node_modules", `${index}.js`), "ignored", "utf8")))

  const index = await buildFileIndex(root, { limit: 10 })

  expect(index.truncated).toBe(false)
  expect(index.items).toHaveLength(3)
})
