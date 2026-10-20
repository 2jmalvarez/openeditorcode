import { expect, test } from "bun:test"
import { checkReleaseAvailability } from "../bin/update-readiness.js"

const platform = "@2jmalvarez/oec-win32-x64"
function registry(missing?: string) {
  const calls: { url: string; method?: string }[] = []
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    const path = String(url)
    calls.push({ url: path, method: options?.method })
    if (path === missing) return new Response("", { status: 404 })
    if (options?.method === "HEAD") return new Response(null, { status: 200 })
    const name = decodeURIComponent(path.split("/")[3]!)
    return Response.json({ version: "0.2.40", dist: { tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-0.2.40.tgz`, integrity: "sha512-fixture" }, optionalDependencies: { [platform]: "0.2.40" } })
  }) as typeof fetch
  return { request, calls }
}

test("release readiness checks exact public metadata and archive URLs for root and platform", async () => {
  const { request, calls } = registry()
  await checkReleaseAvailability("0.2.40", [platform], { fetch: request })
  expect(calls).toHaveLength(4)
  expect(calls.filter((call) => call.method === "HEAD").map((call) => call.url)).toEqual([
    "https://registry.npmjs.org/openeditorcode/-/openeditorcode-0.2.40.tgz",
    "https://registry.npmjs.org/@2jmalvarez/oec-win32-x64/-/oec-win32-x64-0.2.40.tgz",
  ])
  expect(calls.every((call) => !call.url.includes("?"))).toBe(true)
})

for (const missing of [
  "https://registry.npmjs.org/openeditorcode/-/openeditorcode-0.2.40.tgz",
  "https://registry.npmjs.org/%402jmalvarez%2Foec-win32-x64/0.2.40",
  "https://registry.npmjs.org/@2jmalvarez/oec-win32-x64/-/oec-win32-x64-0.2.40.tgz",
]) test(`release readiness rejects unavailable ${missing}`, async () => {
  await expect(checkReleaseAvailability("0.2.40", [platform], { fetch: registry(missing).request })).rejects.toThrow("404")
})

test("pre-root publication waits for platforms without requiring an unpublished root", async () => {
  const { request, calls } = registry()
  await checkReleaseAvailability("0.2.40", [platform], { fetch: request, includeRoot: false })
  expect(calls).toHaveLength(2)
  expect(calls.every((call) => !call.url.includes("/openeditorcode/"))).toBe(true)
})

test("readiness rejects foreign archives and invalid versions before following URLs", async () => {
  const request = (async () => Response.json({ version: "0.2.40", dist: { tarball: "https://other.invalid/a.tgz", integrity: "sha512-fixture" } })) as unknown as typeof fetch
  await expect(checkReleaseAvailability("0.2.40", [platform], { fetch: request })).rejects.toThrow("invalid registry metadata")
  await expect(checkReleaseAvailability("../latest", [platform], { fetch: request })).rejects.toThrow("Invalid release target")
})
