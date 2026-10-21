import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FileSearch, resultTree } from "../src/explorer/file-search"

test("content search is literal, safe, cancellable and independent of name mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-content-search-"))
  const search = new FileSearch(root, "literal")
  try {
    await mkdir(join(root, "nested")); await mkdir(join(root, ".git")); await mkdir(join(root, "ignored"))
    await writeFile(join(root, ".gitignore"), "ignored/\n")
    await writeFile(join(root, "nested", "a.txt"), "Literal NEEDLE.* / text")
    await writeFile(join(root, "binary"), "needle.*\0")
    await writeFile(join(root, "large"), "needle.*" + "x".repeat(2 * 1024 * 1024))
    await writeFile(join(root, ".git", "secret"), "needle.*")
    await writeFile(join(root, "ignored", "secret"), "needle.*")
    await search.search("needle.*")
    expect(search.items).toEqual([])
    await search.toggleTarget()
    expect(search.items.map((item) => item.path)).toEqual([join(root, "nested", "a.txt")])
    expect(search.rows[0]?.directory).toBe(true)
    await Promise.all([search.search("no match"), search.search("NEEDLE.*")])
    expect(search.items).toHaveLength(1)
    await Promise.all([search.search("needle"), search.search("")])
    expect(search.items).toEqual([])
    expect(search.loading).toBe(false)
    await search.toggleTarget()
    expect(search.mode).toBe("literal")
    await search.search("a.txt")
    expect(search.items).toHaveLength(1)
  } finally { search.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("quick search finds files in closed folders by case-insensitive name/path and respects ignores", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-quick-search-"))
  const search = new FileSearch(root)
  try {
    await mkdir(join(root, "src", "nested"), { recursive: true })
    await mkdir(join(root, ".git"))
    await mkdir(join(root, "ignored"))
    await writeFile(join(root, ".gitignore"), "ignored/\n")
    await writeFile(join(root, "src", "nested", "Hello.ts"), "hello")
    await writeFile(join(root, ".git", "secret.ts"), "git")
    await writeFile(join(root, "ignored", "Hello.ts"), "ignored")
    await search.search("HELLO")
    expect(search.items.map((item) => item.path)).toEqual([join(root, "src", "nested", "Hello.ts")])
    await search.search("src/nested/hello")
    expect(search.items).toHaveLength(1)
    await search.search("src\\nested\\hello")
    expect(search.items).toHaveLength(1)
    search.move(100)
    expect(search.rows[search.selected]?.path).toBe(join(root, "src", "nested", "Hello.ts"))
    await search.search("secret")
    expect(search.items).toHaveLength(0)
    await search.search("")
    expect(search.query).toBe("")
    expect(search.items).toHaveLength(0)
    await writeFile(join(root, "new.txt"), "new")
    await search.search("new.txt")
    expect(search.items).toHaveLength(0)
    await search.refresh()
    expect(search.items.map((item) => item.path)).toEqual([join(root, "new.txt")])
  } finally { search.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("a stale indexing response uses the latest query, not an earlier search", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-quick-search-"))
  const search = new FileSearch(root)
  try {
    await writeFile(join(root, "first.txt"), "a")
    await writeFile(join(root, "second.txt"), "b")
    await Promise.all([search.search("first"), search.search("second")])
    expect(search.items.map((item) => item.name)).toEqual(["second.txt"])
    search.invalidate()
    await Promise.all([search.search("first"), search.search("")])
    expect(search.items).toEqual([])
  } finally { search.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("search results form a sorted tree with shared ancestors and independent expansion", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-search-tree-"))
  const search = new FileSearch(root)
  try {
    await mkdir(join(root, "src", "nested"), { recursive: true })
    await mkdir(join(root, "tests"))
    for (const path of [join(root, "src", "nested", "hello.ts"), join(root, "src", "hello.ts"), join(root, "tests", "hello.ts")]) await writeFile(path, "hello")
    await writeFile(join(root, "unrelated.txt"), "hidden")
    await search.search("hello")
    expect(search.rows.map((row) => [row.name, row.depth, row.directory])).toEqual([
      ["src", 0, true], ["nested", 1, true], ["hello.ts", 2, false], ["hello.ts", 1, false], ["tests", 0, true], ["hello.ts", 1, false],
    ])
    expect(search.rows[search.selected]?.directory).toBe(false)
    search.select(1); search.toggle()
    expect(search.rows.map((row) => row.name)).toEqual(["src", "nested", "hello.ts", "tests", "hello.ts"])
    expect(search.rows[search.selected]?.expanded).toBe(false)
    search.toggle(); search.select(2); search.collapse()
    expect(search.rows[search.selected]?.name).toBe("nested")
    search.collapse()
    expect(search.rows[search.selected]?.expanded).toBe(false)
    await search.search("")
    expect(search.rows).toEqual([])
    expect(resultTree(root, [])).toEqual([])
  } finally { search.dispose(); await rm(root, { recursive: true, force: true }) }
})
