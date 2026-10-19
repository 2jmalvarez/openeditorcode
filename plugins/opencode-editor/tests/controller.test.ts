import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"

let root = ""
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "oec-controller-")); await writeFile(join(root, "hello.txt"), "disk") })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test("toggle returns to the same conversation without saving drafts or affecting the session", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await controller.open(join(root, "hello.txt"), "session-1")
    controller.workspace.edit(controller.workspace.activePath!, "unsaved")
    await controller.toggle()
    expect(host.destinations.at(-1)).toEqual({ type: "session", sessionID: "session-1" })
    expect(await readFile(join(root, "hello.txt"), "utf8")).toBe("disk")
    await controller.toggle()
    expect(controller.workspace.active?.content).toBe("unsaved")
    expect(host.destinations.at(-1)?.type).toBe("plugin")
    expect(host.archives.size).toBe(1)
  } finally { await controller.dispose() }
})

test("cancel, save and discard close choices preserve the correct document", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await controller.open(join(root, "hello.txt"))
    const path = controller.workspace.activePath!
    controller.workspace.edit(path, "draft")
    host.selections.push("cancel")
    await controller.close(path)
    expect(controller.workspace.documents).toHaveLength(1)
    host.selections.push("save")
    await controller.close(path)
    expect(controller.workspace.documents).toHaveLength(0)
    expect(await readFile(path, "utf8")).toBe("draft")
    await controller.open(path)
    controller.workspace.edit(path, "discard me")
    host.selections.push("discard")
    await controller.close(path)
    expect(await readFile(path, "utf8")).toBe("draft")
  } finally { await controller.dispose() }
})

test("foreign session locations cannot enter or open the configured local project", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await expect(controller.enter("foreign-session")).rejects.toThrow("localRoot")
    await expect(controller.open(join(root, "hello.txt"), "foreign-session")).rejects.toThrow("localRoot")
    expect(controller.workspace.documents).toHaveLength(0)
    expect(host.destinations).toHaveLength(0)
  } finally { await controller.dispose() }
})

test("declining recovery preserves the old generation's drafts", async () => {
  const host = mockHost(root)
  const options = parseOptions({ localRoot: root })
  const first = new EditorController(host.context, options)
  await first.open(join(root, "hello.txt"))
  first.workspace.edit(first.workspace.activePath!, "recover me")
  await first.dispose()
  const archive = [...host.archives.values()][0] as { instances: Record<string, unknown> }
  const oldID = Object.keys(archive.instances)[0]!
  const second = new EditorController(host.context, options)
  try {
    // mock select returns undefined (Escape); this is not an instruction to discard.
    await second.open(join(root, "hello.txt"))
    second.workspace.edit(second.workspace.activePath!, "new generation")
    await second.drafts.flush()
    expect(Object.keys(archive.instances)).toHaveLength(2)
    expect(archive.instances[oldID]).toBeDefined()
  } finally { await second.dispose() }
})

test("explicit recovery survives plugin reload without automatically writing the project", async () => {
  const host = mockHost(root)
  const options = parseOptions({ localRoot: root })
  const first = new EditorController(host.context, options)
  await first.open(join(root, "hello.txt"))
  first.workspace.edit(first.workspace.activePath!, "recover me")
  await first.dispose()
  const archive = [...host.archives.values()][0] as { instances: Record<string, unknown> }
  host.selections.push(Object.keys(archive.instances)[0])
  const second = new EditorController(host.context, options)
  try {
    await second.enter()
    expect(second.workspace.active?.content).toBe("recover me")
    expect(await readFile(join(root, "hello.txt"), "utf8")).toBe("disk")
    expect(Object.keys(archive.instances)).toHaveLength(1)
  } finally { await second.dispose() }
})

test("sensitive names and custom exclusions never persist content, baseline or active path", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root, drafts: { exclude: ["private/**"] } }))
  try {
    await mkdir(join(root, "private"))
    for (const name of [".env", ".env.production", "server.pem", "id_ed25519", ".npmrc", "private/data.txt"]) {
      const path = join(root, name)
      await writeFile(path, "sensitive-baseline")
      await controller.open(path)
      controller.workspace.edit(path, "sensitive-edit")
    }
    await controller.drafts.flush()
    expect(JSON.stringify([...host.archives.values()])).not.toContain("sensitive")
    expect(JSON.stringify([...host.archives.values()])).not.toContain(".env")
    expect(controller.workspace.documents).toHaveLength(6)
    expect(await controller.save()).toBe(true)
  } finally { await controller.dispose() }
})

test("disabled persistence stops new copies without silently deleting older user work", async () => {
  const host = mockHost(root)
  const first = new EditorController(host.context, parseOptions({ localRoot: root }))
  await first.open(join(root, "hello.txt"))
  first.workspace.edit(first.workspace.activePath!, "old-generation")
  await first.dispose()
  expect(JSON.stringify([...host.archives.values()])).toContain("old-generation")
  const second = new EditorController(host.context, parseOptions({ localRoot: root, drafts: { enabled: false } }))
  try {
    await second.open(join(root, "hello.txt"))
    second.workspace.edit(second.workspace.activePath!, "disabled-generation")
    await second.drafts.flush()
    expect(JSON.stringify([...host.archives.values()])).toContain("old-generation")
    expect(JSON.stringify([...host.archives.values()])).not.toContain("disabled-generation")
    expect(second.workspace.active?.content).toBe("disabled-generation")
  } finally { await second.dispose() }
})

test("explicit deletion confirms and clears archives without discarding open edits", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await controller.open(join(root, "hello.txt"))
    controller.workspace.edit(controller.workspace.activePath!, "keep-in-memory")
    await controller.drafts.flush()
    await controller.clearStoredDrafts()
    expect(JSON.stringify([...host.archives.values()])).toContain("keep-in-memory")
    host.selections.push(true)
    await controller.clearStoredDrafts()
    expect(JSON.stringify([...host.archives.values()])).not.toContain("keep-in-memory")
    expect(controller.workspace.active?.content).toBe("keep-in-memory")
    expect(await readFile(join(root, "hello.txt"), "utf8")).toBe("disk")
  } finally { await controller.dispose() }
})

test("recovery filters legacy sensitive documents without copying or silently deleting them", async () => {
  const host = mockHost(root)
  const first = new EditorController(host.context, parseOptions({ localRoot: root }))
  await first.open(join(root, "hello.txt"))
  first.workspace.edit(first.workspace.activePath!, "ordinary-draft")
  await first.dispose()
  const archive = [...host.archives.values()][0] as { instances: Record<string, ReturnType<typeof first.workspace.snapshot>> }
  const oldID = Object.keys(archive.instances)[0]!
  const old = archive.instances[oldID]
  old.documents.push({ ...old.documents[0], path: join(root, ".env"), content: "excluded-legacy", savedContent: "excluded-baseline" })
  host.selections.push(oldID)
  const second = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await second.enter()
    expect(second.workspace.documents.map((document) => document.path)).toEqual([join(root, "hello.txt")])
    expect(archive.instances[oldID].documents).toHaveLength(1)
    expect(archive.instances[oldID].documents[0].content).toBe("excluded-legacy")
    for (const [id, snapshot] of Object.entries(archive.instances)) {
      if (id !== oldID) expect(JSON.stringify(snapshot)).not.toContain("excluded-")
    }
    host.selections.push(true)
    await second.clearStoredDrafts()
    expect(archive.instances).toEqual({})
  } finally { await second.dispose() }
})
