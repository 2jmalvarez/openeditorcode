import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createTextFile, ensureInsideRoot, FileAccessError, readTextFile, writeTextFile } from "../src/documents/files"
import { fuzzyScore, filterItems } from "../src/search/file-index"
import { countProjectLines, searchProjectText } from "../src/search/project-search"
import { createTree } from "../src/explorer/tree"

let root = ""

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-"))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("file access", () => {
  test("reads and atomically writes UTF-8 text inside the selected root", async () => {
    const path = join(root, "notes.txt")
    await writeFile(path, "first", "utf8")

    expect(await readTextFile(root, path)).toBe("first")
    await writeTextFile(root, path, "updated\ncontent")
    expect(await readTextFile(root, path)).toBe("updated\ncontent")
  })

  test("blocks paths outside the selected root", () => {
    expect(() => ensureInsideRoot(root, join(root, "..", "outside.txt"))).toThrow(FileAccessError)
  })

  test("rejects binary files", async () => {
    const path = join(root, "image.bin")
    await writeFile(path, Buffer.from([0x48, 0x00, 0x49]))
    await expect(readTextFile(root, path)).rejects.toThrow("binarios")
  })

  test("creates an empty file without overwriting an existing one", async () => {
    const path = join(root, "new-file.ts")
    await createTextFile(root, path)
    expect(await readTextFile(root, path)).toBe("")
    await expect(createTextFile(root, path)).rejects.toThrow("Ya existe")
  })
})

describe("fuzzy search", () => {
  test("ranks compact ordered matches and rejects incomplete queries", () => {
    expect(fuzzyScore("app", "src/app.tsx")).toBeGreaterThan(0)
    expect(fuzzyScore("xyz", "src/app.tsx")).toBeUndefined()
  })

  test("returns ranked and limited tree items", () => {
    const items = [
      { path: join(root, "src", "app.tsx"), name: "app.tsx", depth: 1, directory: false, ignored: false },
      { path: join(root, "src", "api.ts"), name: "api.ts", depth: 1, directory: false, ignored: false },
    ]
    expect(filterItems(root, items, "app")).toEqual([items[0]])
  })
})

describe("project search", () => {
  test("counts text lines and reports matching files with line numbers", async () => {
    await writeFile(join(root, "first.ts"), "const target = 1\nconsole.log(target)\n", "utf8")
    await writeFile(join(root, "second.txt"), "target appears here", "utf8")

    expect(await countProjectLines(root)).toEqual({
      files: 2,
      lines: 3,
      byPath: {
        [join(root, "first.ts")]: 2,
        [join(root, "second.txt")]: 1,
      },
    })
    expect(await searchProjectText(root, "target")).toEqual([
      { path: join(root, "first.ts"), line: 1, preview: "const target = 1" },
      { path: join(root, "first.ts"), line: 2, preview: "console.log(target)" },
      { path: join(root, "second.txt"), line: 1, preview: "target appears here" },
    ])
  })

  test("shows .gitignore entries as ignored and excludes them from counts and search", async () => {
    const modules = join(root, "node_modules")
    await mkdir(modules)
    await writeFile(join(root, ".gitignore"), "node_modules/\n*.generated.ts\n", "utf8")
    await writeFile(join(root, "included.ts"), "const needle = true\n", "utf8")
    await writeFile(join(root, "ignored.generated.ts"), "const needle = true\n", "utf8")
    await writeFile(join(modules, "package.js"), "const needle = true\n", "utf8")

    const tree = await createTree(root, new Set([root, modules]))
    expect(tree.find((item) => item.name === "node_modules")?.ignored).toBe(true)
    expect(tree.find((item) => item.name === "ignored.generated.ts")?.ignored).toBe(true)
    expect(tree.find((item) => item.name === "package.js")?.ignored).toBe(true)
    expect(await countProjectLines(root)).toEqual({
      files: 2,
      lines: 3,
      byPath: {
        [join(root, ".gitignore")]: 2,
        [join(root, "included.ts")]: 1,
      },
    })
    expect(await searchProjectText(root, "needle")).toEqual([
      { path: join(root, "included.ts"), line: 1, preview: "const needle = true" },
    ])
  })
})
