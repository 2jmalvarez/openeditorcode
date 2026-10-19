import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FileSearch } from "../src/explorer/file-search"

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
    expect(search.selected).toBe(0)
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
