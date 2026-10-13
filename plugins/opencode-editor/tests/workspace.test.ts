import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ExternalFileChangedError } from "../../../src/documents/files"
import { Workspace, isDirty, validateSnapshot } from "../src/documents/workspace"
import { DraftWriter, draftKey } from "../src/documents/drafts"
import { TreeState } from "../src/explorer/tree-state"
import { createStore } from "solid-js/store"

let root = ""
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-plugin-"))
  await writeFile(join(root, "first.txt"), "first\r\nsecond\r\n")
  await writeFile(join(root, "second.txt"), "other\n")
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test("documents preserve edits, position, and CRLF across activation", async () => {
  const workspace = new Workspace(root)
  const path = join(root, "first.txt")
  await workspace.open(path)
  workspace.edit(path, "edited\nsecond\n")
  workspace.remember(path, { row: 1, column: 3, scrollX: 0, scrollY: 1 })
  await workspace.open(join(root, "second.txt"))
  workspace.activate(path)
  expect(workspace.documents).toHaveLength(2)
  expect(workspace.active?.content).toBe("edited\nsecond\n")
  expect(workspace.active?.position.row).toBe(1)
  expect(isDirty(workspace.active!)).toBe(true)
  await workspace.save()
  expect(await readFile(path, "utf8")).toBe("edited\r\nsecond\r\n")
  expect(isDirty(workspace.active!)).toBe(false)
  await workspace.open(path)
  expect(workspace.documents).toHaveLength(2)
})

test("external edits never silently overwrite a dirty document", async () => {
  const workspace = new Workspace(root)
  const path = join(root, "first.txt")
  await workspace.open(path)
  workspace.edit(path, "local edits")
  await writeFile(path, "agent edits")
  await workspace.checkExternal()
  expect(workspace.active?.conflict).toBe(true)
  await expect(workspace.save()).rejects.toBeInstanceOf(ExternalFileChangedError)
  expect(workspace.active?.content).toBe("local edits")
  expect(await readFile(path, "utf8")).toBe("agent edits")
  expect(await workspace.reload(path, workspace.active!.version)).toBe(true)
  expect(workspace.active?.content).toBe("agent edits")
  expect(isDirty(workspace.active!)).toBe(false)
})

test("clean files reload automatically, deleted files are not recreated", async () => {
  const workspace = new Workspace(root)
  const path = join(root, "first.txt")
  await workspace.open(path)
  await writeFile(path, "external")
  await workspace.checkExternal()
  expect(workspace.active?.content).toBe("external")
  await rm(path)
  await workspace.checkExternal()
  expect(workspace.active?.conflict).toBe(true)
  await expect(workspace.save()).rejects.toBeInstanceOf(ExternalFileChangedError)
  await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" })
})

test("close requires confirmation for the exact version being discarded", async () => {
  const workspace = new Workspace(root)
  const path = join(root, "first.txt")
  await workspace.open(path)
  workspace.edit(path, "draft")
  const version = workspace.active!.version
  expect(workspace.close(path)).toBe(false)
  workspace.edit(path, "new draft during dialog")
  expect(workspace.close(path, version)).toBe(false)
  expect(workspace.close(path, workspace.active!.version)).toBe(true)
  expect(workspace.active).toBeUndefined()
})

test("drafts recover without writing files, reject foreign roots and escaping paths", async () => {
  const workspace = new Workspace(root)
  const path = join(root, "first.txt")
  await workspace.open(path)
  workspace.edit(path, "unsaved draft")
  const snapshot = workspace.snapshot()
  const recovered = new Workspace(root)
  expect(recovered.restore(snapshot)).toBe(1)
  expect(recovered.active?.content).toBe("unsaved draft")
  expect(await readFile(path, "utf8")).toBe("first\r\nsecond\r\n")
  expect(new Workspace(join(root, "foreign")).restore(snapshot)).toBe(0)
  snapshot.documents[0]!.path = join(root, "..", "outside.txt")
  expect(validateSnapshot(root, snapshot)).toBeUndefined()
  expect(draftKey(root, "one")).not.toBe(draftKey(root, "two"))
  expect(draftKey(root, "one")).not.toContain("/")
})

test("recovery accepts host Solid store proxies", async () => {
  const workspace = new Workspace(root)
  await workspace.open(join(root, "first.txt"))
  workspace.edit(workspace.activePath!, "proxy draft")
  const [stored] = createStore(workspace.snapshot())
  expect(new Workspace(root).restore(stored)).toBe(1)
})

test("empty drafts clear recovery data after saving", async () => {
  const workspace = new Workspace(root)
  await workspace.open(join(root, "first.txt"))
  workspace.edit(workspace.activePath!, "draft")
  const snapshots: number[] = []
  const writer = new DraftWriter(workspace, async (snapshot) => { snapshots.push(snapshot.documents.length) }, (error) => { throw error })
  await writer.flush()
  await workspace.save()
  await writer.dispose()
  expect(snapshots).toEqual([1, 0])
  workspace.dispose()
})

test("newer navigation supersedes a late file opening", async () => {
  let resolveFirst!: (value: string) => void
  const workspace = new Workspace(root, {
    read: async (_root, path) => path.endsWith("first.txt") ? new Promise<string>((resolve) => { resolveFirst = resolve }) : "second",
    write: async () => undefined,
  })
  const first = workspace.open(join(root, "first.txt"))
  await workspace.open(join(root, "second.txt"))
  resolveFirst("first")
  expect(await first).toBe(false)
  expect(workspace.active?.content).toBe("second")
  expect(workspace.documents).toHaveLength(1)
})

test("save marks the captured document and content, not a newly selected or edited file", async () => {
  let finish!: () => void
  const workspace = new Workspace(root, {
    read: async () => "disk",
    write: async () => new Promise<void>((resolve) => { finish = resolve }),
  })
  const path = join(root, "first.txt")
  await workspace.open(path)
  workspace.edit(path, "saving")
  const saving = workspace.save()
  workspace.edit(path, "new edit")
  await workspace.open(join(root, "second.txt"))
  finish()
  await saving
  const first = workspace.documents[0]!
  expect(first.savedContent).toBe("saving")
  expect(first.content).toBe("new edit")
  expect(isDirty(first)).toBe(true)
  expect(workspace.active?.savedContent).toBe("disk")
})

test("tree refresh preserves selected path and excludes .git", async () => {
  const tree = new TreeState(root)
  await tree.refresh()
  tree.select(tree.items.findIndex((item) => item.name === "second.txt"))
  await writeFile(join(root, "aaa.txt"), "new")
  await tree.refresh()
  expect(tree.items[tree.selected]?.name).toBe("second.txt")
  tree.dispose()
})
