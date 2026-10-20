import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"
import { useUpdates } from "../src/updates/useUpdates"
import { isNewerVersion } from "../src/updates/version"

test("detects newer semantic versions", () => {
  expect(isNewerVersion("0.2.3", "0.2.4")).toBe(true)
  expect(isNewerVersion("0.2.3", "0.3.0")).toBe(true)
  expect(isNewerVersion("0.2.3", "1.0.0")).toBe(true)
})

test("does not offer an update when latest exists but its public archive returns 404", async () => {
  const previous = process.env.OEC_NPM_LAUNCHER
  process.env.OEC_NPM_LAUNCHER = "1"
  const request = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (_url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === "HEAD") return new Response(null, { status: 404 })
    return Response.json({ version: "999.0.0", dist: { tarball: "https://registry.npmjs.org/openeditorcode/-/openeditorcode-999.0.0.tgz", integrity: "sha512-fixture" }, optionalDependencies: { "@2jmalvarez/oec-win32-x64": "999.0.0", "@2jmalvarez/oec-linux-x64": "999.0.0" } })
  }, { preconnect: globalThis.fetch.preconnect }))
  const state = createRoot((dispose) => ({ dispose, updates: useUpdates() }))
  try {
    await new Promise((resolve) => setTimeout(resolve, 1150))
    expect(request).toHaveBeenCalledTimes(3)
    expect(state.updates.latestVersion()).toBeUndefined()
    expect(state.updates.canUpdate()).toBe(false)
  } finally {
    state.dispose(); request.mockRestore()
    if (previous === undefined) delete process.env.OEC_NPM_LAUNCHER
    else process.env.OEC_NPM_LAUNCHER = previous
  }
})

test("rejects equal, older, and invalid versions", () => {
  expect(isNewerVersion("0.2.3", "0.2.3")).toBe(false)
  expect(isNewerVersion("0.2.3", "0.2.2")).toBe(false)
  expect(isNewerVersion("0.2.3", "latest")).toBe(false)
})

test("orders prerelease versions below stable releases", () => {
  expect(isNewerVersion("1.0.0-beta.1", "1.0.0")).toBe(true)
  expect(isNewerVersion("1.0.0", "1.0.1-beta.1")).toBe(true)
  expect(isNewerVersion("1.0.0", "1.0.0-beta.1")).toBe(false)
})

test.each([
  [undefined, true, false],
  ["0", true, false],
  ["1", false, false],
  ["1", true, true],
] as const)("update checks require the npm launcher and startup opt-in: %s, %s", async (launcher, checkOnStartup, expected) => {
  const previous = process.env.OEC_NPM_LAUNCHER
  if (launcher === undefined) delete process.env.OEC_NPM_LAUNCHER
  else process.env.OEC_NPM_LAUNCHER = launcher
  const request = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (url: RequestInfo | URL, options?: RequestInit) => {
    if (options?.method === "HEAD") return new Response(null)
    const name = String(url).endsWith("/latest") ? "openeditorcode" : decodeURIComponent(String(url).split("/")[3]!)
    return Response.json({ version: "999.0.0", dist: { tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-999.0.0.tgz`, integrity: "sha512-fixture" }, optionalDependencies: { "@2jmalvarez/oec-win32-x64": "999.0.0", "@2jmalvarez/oec-linux-x64": "999.0.0" } })
  }, { preconnect: globalThis.fetch.preconnect }))
  const state = createRoot((dispose) => ({ dispose, updates: useUpdates(checkOnStartup) }))
  try {
    expect(state.updates.canUpdate()).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 1150))
    expect(request).toHaveBeenCalledTimes(expected ? 5 : 0)
    expect(state.updates.latestVersion()).toBe(expected ? "999.0.0" : undefined)
    expect(state.updates.canUpdate()).toBe(expected)
    if (expected) expect(request.mock.calls[0]?.[0]).toBe("https://registry.npmjs.org/openeditorcode/latest")
  } finally {
    state.dispose()
    request.mockRestore()
    if (previous === undefined) delete process.env.OEC_NPM_LAUNCHER
    else process.env.OEC_NPM_LAUNCHER = previous
  }
})
