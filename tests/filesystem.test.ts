import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createTextFile, ensureInsideRoot, FileAccessError, MAX_FILE_BYTES, readTextFile, removeProjectEntry, writeTextFile } from "../src/documents/files"
import { fuzzyScore, filterItems } from "../src/search/file-index"
import { countProjectLines, searchProjectText } from "../src/search/project-search"
import { createTree } from "../src/explorer/tree"
import { pathIsAffected } from "../src/documents/useDocuments"

let root = ""

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-"))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe("file access", () => {
  test("identifies files affected by an exact entry or directory deletion", () => {
    expect(pathIsAffected(join(root, "notes.txt"), join(root, "notes.txt"), false)).toBe(true)
    expect(pathIsAffected(join(root, "folder"), join(root, "folder", "notes.txt"), true)).toBe(true)
    expect(pathIsAffected(join(root, "folder"), join(root, "folder-two", "notes.txt"), true)).toBe(false)
  })

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

  test("allows names beginning with two dots inside the selected root", () => {
    expect(ensureInsideRoot(root, join(root, "..foo"))).toBe(join(root, "..foo"))
  })

  test("rejects binary files", async () => {
    const path = join(root, "image.bin")
    await writeFile(path, Buffer.from([0x48, 0x00, 0x49]))
    await expect(readTextFile(root, path)).rejects.toThrow("binarios")
  })

  test("rejects invalid UTF-8 text", async () => {
    const path = join(root, "invalid.txt")
    await writeFile(path, Buffer.from([0xc3, 0x28]))
    await expect(readTextFile(root, path)).rejects.toThrow("UTF-8")
  })

  test("rejects writes above the UTF-8 byte limit", async () => {
    const path = join(root, "large.txt")
    const content = "é".repeat(MAX_FILE_BYTES / 2 + 1)
    await expect(writeTextFile(root, path, content)).rejects.toThrow("2 MB")
  })

  test("uses unique temporary names and cleans them after saving", async () => {
    const path = join(root, "notes.txt")
    const oldTemporaryPath = `${path}.oec-${process.pid}.tmp`
    await writeFile(path, "old", "utf8")
    await writeFile(oldTemporaryPath, "keep", "utf8")

    await writeTextFile(root, path, "new")

    expect(await readFile(oldTemporaryPath, "utf8")).toBe("keep")
    expect((await readdir(root)).filter((name) => name.startsWith("notes.txt.oec-") && name !== `notes.txt.oec-${process.pid}.tmp`)).toEqual([])
  })

  test("creates an empty file without overwriting an existing one", async () => {
    const path = join(root, "new-file.ts")
    await createTextFile(root, path)
    expect(await readTextFile(root, path)).toBe("")
    await expect(createTextFile(root, path)).rejects.toThrow("Ya existe")
  })

  test("removes a file or directory inside the selected root but never the root", async () => {
    const directory = join(root, "obsolete")
    const file = join(directory, "notes.txt")
    await mkdir(directory)
    await writeFile(file, "remove me", "utf8")

    await removeProjectEntry(root, directory)
    await expect(readTextFile(root, file)).rejects.toThrow()
    await expect(removeProjectEntry(root, root)).rejects.toThrow("raíz")
  })

  test("rejects link escapes while allowing links that resolve inside the root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "oec-outside-"))
    const internalDirectory = join(root, "internal")
    const internalLink = join(root, "internal-link")
    const escapingLink = join(root, "escaping-link")
    await mkdir(internalDirectory)
    await writeFile(join(internalDirectory, "inside.txt"), "inside", "utf8")
    await writeFile(join(outside, "outside.txt"), "outside", "utf8")

    try {
      try {
        await symlink(internalDirectory, internalLink, process.platform === "win32" ? "junction" : "dir")
        await symlink(outside, escapingLink, process.platform === "win32" ? "junction" : "dir")
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") return
        throw error
      }

      expect(await readTextFile(root, join(internalLink, "inside.txt"))).toBe("inside")
      await writeTextFile(root, join(internalLink, "written.txt"), "written")
      await createTextFile(root, join(internalLink, "created.txt"))
      expect(await readFile(join(internalDirectory, "written.txt"), "utf8")).toBe("written")
      await expect(readTextFile(root, join(escapingLink, "outside.txt"))).rejects.toThrow(FileAccessError)
      await expect(writeTextFile(root, join(escapingLink, "written.txt"), "blocked")).rejects.toThrow(FileAccessError)
      await expect(createTextFile(root, join(escapingLink, "created.txt"))).rejects.toThrow(FileAccessError)
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  test("removes an escaping link itself without following its destination", async () => {
    const outside = await mkdtemp(join(tmpdir(), "oec-outside-"))
    const link = join(root, "outside-link")
    const destinationFile = join(outside, "keep.txt")
    await writeFile(destinationFile, "keep", "utf8")

    try {
      try {
        await symlink(outside, link, process.platform === "win32" ? "junction" : "dir")
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") return
        throw error
      }

      await removeProjectEntry(root, link)
      await expect(lstat(link)).rejects.toThrow()
      expect(await readFile(destinationFile, "utf8")).toBe("keep")
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
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
