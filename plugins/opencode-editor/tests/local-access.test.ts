import { expect, test } from "bun:test"
import { join, resolve } from "node:path"
import { createLocalAccess } from "../src/integration/local-access"
import { mockHost } from "./host"

test("remembered local access survives recreation but grants only the exact folder", async () => {
  const root = resolve("trusted-project")
  const host = mockHost(root)
  const first = createLocalAccess(host.context.storage, "this-machine")
  expect(first.trusted(root)).toBe(false)
  await first.remember(root)
  const next = createLocalAccess(host.context.storage, "this-machine")
  expect(next.trusted(root)).toBe(true)
  expect(next.trusted(join(root, "child"))).toBe(false)
  expect(next.trusted(resolve("different-project"))).toBe(false)
  expect(next.trusted(join(root, "child", ".."))).toBe(true)
  expect(createLocalAccess(host.context.storage, "other-machine").trusted(root)).toBe(false)
  await next.forget(root)
  expect(first.trusted(root)).toBe(false)
})

test("remembered local access rejects malformed or relative stored grants", () => {
  const root = resolve("trusted-project")
  const host = mockHost(root)
  const access = createLocalAccess(host.context.storage, "machine")
  const entry = [...host.archives.values()][0] as { folders: unknown }
  for (const invalid of [null, true, "*", [true, null, "relative/path", "*"]]) {
    entry.folders = invalid
    expect(access.trusted(root)).toBe(false)
    expect(access.folders()).toEqual([])
  }
})

test.skipIf(process.platform !== "win32")("Windows remembered paths use normalized case-insensitive keys", async () => {
  const root = resolve("Trusted-Project")
  const host = mockHost(root)
  const access = createLocalAccess(host.context.storage, "machine")
  await access.remember(root)
  await access.remember(root.toUpperCase())
  expect(access.folders()).toHaveLength(1)
  expect(access.trusted(root.toLowerCase())).toBe(true)
  await access.forget(root.toLowerCase())
  expect(access.folders()).toHaveLength(0)
})
