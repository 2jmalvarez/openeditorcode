const registry = "https://registry.npmjs.org/"

// Check the exact URLs npm will use, without cache-busting: an uncached URL can
// work while the public URL still serves a cached 404 to actual installations.
export async function checkReleaseAvailability(version, platforms, options = {}) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || !platforms.length || platforms.some((name) => !["@2jmalvarez/oec-win32-x64", "@2jmalvarez/oec-linux-x64"].includes(name))) throw new Error("Invalid release target")
  const request = options.fetch ?? fetch
  const names = [...(options.includeRoot === false ? [] : ["openeditorcode"]), ...platforms]
  for (const name of names) {
    const response = await request(`${registry}${encodeURIComponent(name)}/${version}`, { signal: options.signal, cache: "no-store" })
    if (!response.ok) throw new Error(`${name}@${version}: metadata HTTP ${response.status}`)
    const metadata = await response.json()
    const basename = name.split("/").at(-1)
    const expected = `${registry}${name}/-/${basename}-${version}.tgz`
    if (metadata.version !== version || metadata.dist?.tarball !== expected || typeof metadata.dist?.integrity !== "string") throw new Error(`${name}@${version}: invalid registry metadata`)
    if (name === "openeditorcode" && platforms.some((platform) => metadata.optionalDependencies?.[platform] !== version)) throw new Error("Mismatched platform dependency versions")
    const archive = await request(expected, { method: "HEAD", signal: options.signal, redirect: "error" })
    if (!archive.ok) throw new Error(`${name}@${version}: archive HTTP ${archive.status}`)
  }
}
