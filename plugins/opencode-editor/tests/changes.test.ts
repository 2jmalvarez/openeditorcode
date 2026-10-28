import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { ChangesState, CHANGES_DEBOUNCE_MS, CHANGES_POLL_MS } from "../src/changes/state"
import type { ChangesReader, LocalChanges } from "../src/changes/git"
import { mockHost } from "./host"

const root = resolve("test-project")
const tick = () => Bun.sleep(0)
const result = (file = "new.txt"): LocalChanges => ({ repository: true, files: [{ file, path: file, status: "modified", area: "changes", additions: 1, deletions: 1 }] })

test("local state distinguishes no repository from a clean repository without consulting the server", async () => {
  const host = mockHost(root)
  let value: LocalChanges = { repository: false, files: [] }
  const calls: string[] = []
  const read: ChangesReader = async (directory) => { calls.push(directory); return value }
  const state = new ChangesState(host.context, root, read)
  try {
    state.start(); await tick()
    expect(state.repository).toBe(false)
    value = result()
    await state.refresh()
    expect(state.repository).toBe(true)
    expect(state.files[0]?.file).toBe("new.txt")
    value = { repository: true, files: [] }; await state.refresh()
    expect(state.files).toEqual([])
    expect(calls.every((directory) => directory === root)).toBe(true)
    expect(host.vcs.calls).toEqual([])
  } finally { state.dispose() }
})

test("events debounce local reads, ignore other projects, poll, and release resources on collapse", async () => {
  const host = mockHost(root)
  let calls = 0
  const state = new ChangesState(host.context, root, async () => { calls++; return result() })
  try {
    state.start(); await tick()
    host.emit({ id: "other", created: 0, type: "filesystem.changed", location: { directory: resolve("other") }, data: { file: "x", event: "change" } })
    await Bun.sleep(CHANGES_DEBOUNCE_MS + 30)
    expect(calls).toBe(1)
    for (let i = 0; i < 10; i++) host.emit({ id: `${i}`, created: 0, type: "filesystem.changed", location: { directory: root }, data: { file: "x", event: "add" } })
    await Bun.sleep(CHANGES_DEBOUNCE_MS + 30)
    expect(calls).toBe(2)
    await Bun.sleep(CHANGES_POLL_MS)
    expect(calls).toBeGreaterThan(2)
    state.stop()
    const before = calls
    await state.refresh()
    expect(calls).toBe(before)
    expect([...host.events.values()].every((handlers) => handlers.size === 0)).toBe(true)
  } finally { state.dispose() }
})

test("coalesces refreshes and aborts generations that can no longer publish", async () => {
  const host = mockHost(root)
  let finish!: (value: LocalChanges) => void
  let signal: AbortSignal | undefined
  const state = new ChangesState(host.context, root, async (_root, abort) => { signal = abort; return new Promise((resolve) => { finish = resolve }) })
  try {
    state.start(); await tick()
    const pending = state.refresh()
    expect(state.refresh()).toBe(pending)
    state.stop()
    expect(signal?.aborted).toBe(true)
    finish(result("stale.txt")); await pending
    expect(state.files).toEqual([])
    expect(state.loading).toBe(false)
  } finally { state.dispose() }
})

test("local Git errors retain stale rows and recover; mapped remote workspaces never query server VCS", async () => {
  const host = mockHost(root)
  let fail = false
  const state = new ChangesState({ ...host.context, location: { directory: root, workspaceID: "remote" } }, root, async () => {
    if (fail) throw new Error("Local Git unavailable")
    return result()
  })
  try {
    state.start(); await tick()
    expect(state.files).toHaveLength(1)
    fail = true; await state.refresh()
    expect(state.error).toBe("Local Git unavailable")
    expect(state.files).toHaveLength(1)
    expect(state.stale).toBe(true)
    fail = false; await state.refresh()
    expect(state.error).toBe("")
    expect(state.stale).toBe(false)
    expect(state.files).toHaveLength(1)
    expect(host.vcs.calls).toEqual([])
  } finally { state.dispose() }
})

test("partial repository failures retain only failed repositories' previous rows and branches", async () => {
  const host = mockHost(root)
  const a = resolve(root, "a"), b = resolve(root, "b")
  let value: LocalChanges = { repository: true, repositories: [
    { id: "a", root: a, name: "a", branch: "main" }, { id: "b", root: b, name: "b", branch: "dev" },
  ], files: [ { ...result("a.txt").files[0]!, repositoryRoot: a }, { ...result("b.txt").files[0]!, repositoryRoot: b } ] }
  const state = new ChangesState(host.context, root, async () => value)
  try {
    state.start(); await tick()
    value = { repository: true, repositories: [
      { id: "a", root: a, name: "a", branch: "", error: "Git refresh timed out" },
      { id: "b", root: b, name: "b", branch: "new" },
    ], files: [] }
    await state.refresh()
    expect(state.files.map((file) => file.file)).toEqual(["a.txt"])
    expect(state.repositories.map((repo) => repo.branch)).toEqual(["main", "new"])
    expect(state.stale).toBe(true)
    await state.refresh()
    expect(state.files).toHaveLength(1)
    value = { repository: true, repositories: [], files: [] }
    await state.refresh()
    expect(state.stale).toBe(false)
    expect(state.files).toEqual([])
  } finally { state.dispose() }
})
