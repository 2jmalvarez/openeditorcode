import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EditorProjects } from "../src/integration/projects"
import { mockHost } from "./host"

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "oec-projects-"))
  const first = join(base, "first"), second = join(base, "second")
  await mkdir(first); await mkdir(second)
  await writeFile(join(first, "same.txt"), "first")
  await writeFile(join(second, "same.txt"), "second")
  const host = mockHost(first)
  const context = { ...host.context, options: {}, location: { directory: first }, data: {
    ...host.context.data,
    session: { ...host.context.data.session, get: (id: string) => ({ id, location: { directory: id === "second" ? second : first } }) as ReturnType<typeof host.context.data.session.get> },
  } }
  const projects = new EditorProjects(context)
  return { ...host, first, second, projects, context, cleanup: async () => { await projects.dispose(); await rm(base, { recursive: true, force: true }) } }
}

test("automatically follows session directories without mixing documents, reuses each workspace", async () => {
  const f = await fixture()
  try {
    expect(f.projects.forSession("session-1")).toBeUndefined()
    f.selections.push("once")
    await f.projects.toggleFiles()
    const first = f.projects.forSession("session-1")!
    expect(first.workspace.root).toBe(f.first)
    expect(first.filesVisible).toBe(true)
    await first.open(join(f.first, "same.txt"), "session-1")
    await first.back()
    f.context.ui.router.navigate({ type: "session", sessionID: "second" })
    f.selections.push("once")
    await f.projects.toggleFiles()
    const second = f.projects.forSession("second")!
    expect(second.workspace.root).toBe(f.second)
    expect(second.workspace.documents).toHaveLength(0)
    await second.open(join(f.second, "same.txt"), "second")
    expect(second.workspace.active?.content).toBe("second")
    expect(first.workspace.active?.content).toBe("first")
    expect(first.accepts("second")).toBe(false)
    await second.back()
    f.context.ui.router.navigate({ type: "session", sessionID: "session-1" })
    await f.projects.toggle()
    expect(f.projects.current()).toBe(first)
    expect(f.projects.current()?.workspace.active?.content).toBe("first")
    expect(f.selections).toHaveLength(0)
  } finally { await f.cleanup() }
})

test("declining local access does not construct a workspace or store drafts", async () => {
  const f = await fixture()
  try {
    f.selections.push("deny")
    await f.projects.toggleFiles()
    expect(f.projects.forSession("session-1")).toBeUndefined()
    expect([...f.archives.keys()].every((key) => key.startsWith("local-access.v1."))).toBe(true)
  } finally { await f.cleanup() }
})

test("explicit localRoot retains opt-in compatibility without confirmation", async () => {
  const f = await fixture()
  const projects = new EditorProjects({ ...f.context, options: { localRoot: f.first } })
  try {
    await projects.toggleFiles()
    expect(projects.forSession("session-1")?.workspace.root).toBe(f.first)
    expect(projects.forSession("second")).toBeUndefined()
  } finally { await projects.dispose(); await f.cleanup() }
})

test("remote workspace references never automatically map onto a local path", async () => {
  const f = await fixture()
  const projects = new EditorProjects({ ...f.context, location: { directory: f.first, workspaceID: "remote" } })
  try {
    f.context.ui.router.navigate({ type: "home" })
    await expect(projects.toggle()).rejects.toThrow("remote")
    expect(f.archives.size).toBe(0)
  } finally { await projects.dispose(); await f.cleanup() }
})

test("switching sessions during consent does not navigate or open the old directory", async () => {
  const f = await fixture()
  const projects = new EditorProjects({ ...f.context, ui: { ...f.context.ui, dialog: { ...f.context.ui.dialog, select: async () => {
    f.context.ui.router.navigate({ type: "session", sessionID: "second" }); return "once" as never
  } } } })
  try {
    await projects.toggle()
    expect(f.context.ui.router.current()).toEqual({ type: "session", sessionID: "second" })
    expect(projects.current()).toBeUndefined()
  } finally { await projects.dispose(); await f.cleanup() }
})

test("missing session data never falls back to the default project", async () => {
  const f = await fixture()
  const projects = new EditorProjects({ ...f.context, data: { ...f.context.data, session: { ...f.context.data.session, get: () => undefined } } })
  try {
    await expect(projects.toggleFiles()).rejects.toThrow("session location")
    expect(f.archives.size).toBe(0)
    expect(projects.forSession("session-1")).toBeUndefined()
  } finally { await projects.dispose(); await f.cleanup() }
})

test("home uses the host location, never the plugin or service working directory", async () => {
  const f = await fixture()
  try {
    f.context.ui.router.navigate({ type: "home" })
    f.selections.push("once")
    await f.projects.toggle()
    expect(f.projects.current()?.workspace.root).toBe(f.first)
  } finally { await f.cleanup() }
})

test("new Files mounts only after the host's post-confirmation focus handoff", async () => {
  const f = await fixture()
  let restored = false
  const mountedAfterRestore: boolean[] = []
  f.context.ui.dialog.select = async () => {
    // The host resolves first and restores prompt focus at the end of dispatch.
    setTimeout(() => { restored = true }, 0)
    return "once" as never
  }
  const stop = f.projects.subscribe(() => { if (f.projects.forSession("session-1")) mountedAfterRestore.push(restored) })
  try {
    await f.projects.toggleFiles()
    expect(mountedAfterRestore.length).toBeGreaterThan(0)
    expect(mountedAfterRestore.every(Boolean)).toBe(true)
  } finally { stop(); await f.cleanup() }
})

test("remembered consent survives a new TUI, but does not authorize a different project", async () => {
  const f = await fixture()
  const restarted = new EditorProjects(f.context)
  try {
    f.selections.push("remember")
    await f.projects.toggleFiles()
    await f.projects.dispose()
    f.selections.push("deny")
    await restarted.toggleFiles()
    expect(restarted.forSession("session-1")?.workspace.root).toBe(f.first)
    expect(f.selections).toEqual(["deny"])
    f.context.ui.router.navigate({ type: "session", sessionID: "second" })
    await restarted.toggleFiles()
    expect(restarted.forSession("second")).toBeUndefined()
    expect(f.selections).toHaveLength(0)
  } finally { await restarted.dispose(); await f.cleanup() }
})

test("one-TUI consent is not persisted; deny, escape and unknown choices fail closed", async () => {
  const f = await fixture()
  try {
    f.selections.push("once")
    await f.projects.toggleFiles()
    await f.projects.dispose()
    for (const choice of ["deny", undefined, "unexpected"]) {
      const restarted = new EditorProjects(f.context)
      try {
        f.selections.push(choice)
        await restarted.toggleFiles()
        expect(restarted.forSession("session-1")).toBeUndefined()
        expect(f.selections).toHaveLength(0)
      } finally { await restarted.dispose() }
    }
  } finally { await f.cleanup() }
})

test("forgetting saved consent preserves open drafts and asks again on the next TUI", async () => {
  const f = await fixture()
  const restarted = new EditorProjects(f.context)
  try {
    f.selections.push("remember")
    await f.projects.toggleFiles()
    const controller = f.projects.forSession("session-1")!
    await controller.open(join(f.first, "same.txt"), "session-1")
    controller.workspace.edit(join(f.first, "same.txt"), "unsaved")
    f.selections.push(f.first, true)
    await f.projects.forgetLocalAccess()
    expect(controller.workspace.active?.content).toBe("unsaved")
    expect(f.toasts.at(-1)).toContain("ask again")
    await controller.back()
    f.selections.push("deny")
    await restarted.toggleFiles()
    expect(restarted.forSession("session-1")).toBeUndefined()
  } finally { await restarted.dispose(); await f.cleanup() }
})

test("saved local trust never bypasses the explicit mapping required for a remote workspace", async () => {
  const f = await fixture()
  const remote = new EditorProjects({ ...f.context, location: { directory: f.first, workspaceID: "remote" } })
  try {
    f.selections.push("remember")
    await f.projects.toggleFiles()
    f.context.ui.router.navigate({ type: "home" })
    await expect(remote.toggle()).rejects.toThrow("remote")
    expect(remote.current()).toBeUndefined()
  } finally { await remote.dispose(); await f.cleanup() }
})
