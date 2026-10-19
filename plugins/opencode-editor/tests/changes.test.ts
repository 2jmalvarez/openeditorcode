import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { ChangesState, CHANGES_DEBOUNCE_MS, CHANGES_POLL_MS } from "../src/changes/state"
import { mockHost } from "./host"

const root = resolve("test-project")
const tick = () => Bun.sleep(0)

test("changes are scoped to the requested directory and distinguish no repo from clean", async () => {
  const host = mockHost(root)
  const state = new ChangesState(host.context, root)
  try {
    state.start(); await tick()
    expect(state.repository).toBe(false)
    expect(state.files).toEqual([])
    host.vcs.provider = "git"
    await state.refresh()
    expect(state.repository).toBe(true)
    host.vcs.files = [
      { file: "z.txt", status: "added", additions: 3, deletions: 0 },
      { file: "a.txt", status: "deleted", additions: 0, deletions: 2 },
    ]
    await state.refresh()
    expect(state.files.map((item) => item.file)).toEqual(["a.txt", "z.txt"])
    expect(host.vcs.calls.every((directory) => directory === root)).toBe(true)
    host.vcs.files = []
    await state.refresh()
    expect(state.files).toEqual([])
  } finally { state.dispose() }
})

test("filesystem events debounce updates, skip other roots, polling and stop release resources", async () => {
  const host = mockHost(root)
  host.vcs.provider = "git"
  const state = new ChangesState(host.context, root)
  try {
    state.start(); await tick()
    const initial = host.vcs.calls.length
    host.emit({ id: "other", created: 0, type: "filesystem.changed", location: { directory: resolve("other") }, data: { file: "x", event: "change" } })
    await Bun.sleep(CHANGES_DEBOUNCE_MS + 30)
    expect(host.vcs.calls.length).toBe(initial)
    host.vcs.files = [{ file: "new.txt", status: "added", additions: 1, deletions: 0 }]
    for (let i = 0; i < 10; i++) host.emit({ id: `${i}`, created: 0, type: "filesystem.changed", location: { directory: root }, data: { file: "new.txt", event: "add" } })
    await Bun.sleep(CHANGES_DEBOUNCE_MS + 30)
    expect(host.vcs.calls.length).toBe(initial + 2)
    expect(state.files[0]?.file).toBe("new.txt")
    host.vcs.files = [{ file: "modified.txt", status: "modified", additions: 5, deletions: 2 }]
    await Bun.sleep(CHANGES_POLL_MS)
    expect(state.files[0]?.file).toBe("modified.txt")
    state.stop()
    expect([...host.events.values()].every((handlers) => handlers.size === 0)).toBe(true)
    const calls = host.vcs.calls.length
    await state.refresh()
    expect(host.vcs.calls.length).toBe(calls)
  } finally { state.dispose() }
})

test("in-flight refreshes coalesce and stopped generations cannot publish stale data", async () => {
  const host = mockHost(root)
  host.vcs.provider = "git"
  let finish!: (value: Awaited<ReturnType<typeof host.context.client.vcs.status>>) => void
  let signal: AbortSignal | undefined
  host.context.client.vcs.status = async (_input, options) => {
    signal = options?.signal
    return new Promise((resolve) => { finish = resolve })
  }
  const state = new ChangesState(host.context, root)
  try {
    state.start(); await tick()
    const pending = state.refresh()
    expect(state.refresh()).toBe(pending)
    state.stop()
    expect(signal?.aborted).toBe(true)
    finish({ location: { directory: root }, data: [{ file: "old.txt", status: "modified", additions: 1, deletions: 1 }] })
    await pending
    expect(state.files).toEqual([])
    expect(state.loading).toBe(false)
  } finally { state.dispose() }
})

test("API errors stay local, recover on refresh, and reject mismatched project data", async () => {
  const host = mockHost(root)
  host.vcs.provider = "git"
  const original = host.context.client.vcs.status
  host.context.client.vcs.status = async () => { throw new Error("VCS unavailable") }
  const state = new ChangesState(host.context, root)
  try {
    state.start(); await tick()
    expect(state.error).toBe("VCS unavailable")
    expect(state.loading).toBe(false)
    host.context.client.vcs.status = original
    await state.refresh()
    expect(state.error).toBe("")
    host.context.client.vcs.status = async () => ({ location: { directory: resolve("another") }, data: [] })
    await state.refresh()
    expect(state.error).toContain("different project")
  } finally { state.dispose() }
})

test("remote localRoot mappings never query server VCS for a coincidentally matching local directory", () => {
  const host = mockHost(root)
  const state = new ChangesState({ ...host.context, location: { directory: root, workspaceID: "remote" } }, root)
  try {
    state.start("session-1")
    expect(state.error).toContain("remote workspace")
    expect(host.vcs.calls).toEqual([])
  } finally { state.dispose() }
})
