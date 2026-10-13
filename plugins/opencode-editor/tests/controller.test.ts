import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
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
