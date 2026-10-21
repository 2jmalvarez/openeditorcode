import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { command, directory, download, integrity, metadata, name, temporary, validateRegistryRevision, validateTag } from "./release"

const mode = process.argv[2]
assert.ok(mode === "before" || mode === "after", "Usage: registry.ts before|after <pack.json> [--published]")
const published = process.argv[4] === "--published"
assert.ok(process.argv[4] === undefined || published, "Unknown registry verification option")
const packPath = resolve(process.argv[3]!)
const pack = await Bun.file(packPath).json()
assert.equal(pack.name, name)
assert.equal(pack.version, (await Bun.file(join(directory, "package.json")).json()).version)
assert.match(pack.commit ?? "", /^[a-f0-9]{40}$/, "Registry verification requires an immutable release commit")
if (published) {
  const tag = `opencode-editor-v${pack.version}`
  validateTag(tag, pack.version)
  assert.equal(mode, "after", "Published-tag verification cannot authorize publication")
  validateRegistryRevision(mode, true, pack.commit, await command(["git", "rev-parse", `${tag}^{commit}`]))
} else if (process.env.GITHUB_ACTIONS === "true") validateRegistryRevision(mode, false, pack.commit, process.env.GITHUB_SHA)
const archive = join(resolve(packPath, ".."), pack.filename)
assert.equal(integrity(new Uint8Array(await Bun.file(archive).arrayBuffer())), pack.integrity)
let found = await metadata(name, pack.version)
if (mode === "after") {
  // New versions and their attestations can take several minutes to propagate.
  for (let attempt = 0; (!found || !found.dist?.attestations?.provenance) && attempt < 36; attempt++) {
    await Bun.sleep(5000)
    found = await metadata(name, pack.version)
  }
  assert.ok(found, "Published version is not visible in the registry")
}
if (found) {
  assert.equal(found.name, name)
  assert.equal(found.version, pack.version)
  assert.equal(found.gitHead, pack.commit, "Existing version belongs to another commit; refusing success")
  assert.equal(found.dist?.integrity, pack.integrity, "Existing version is not this verified artifact")
  assert.ok(found.dist?.attestations?.provenance, "Missing npm provenance")
  const temp = await temporary("oec-registry-")
  try {
    const published = join(temp, "published.tgz")
    await download(found, published)
    assert.equal(await command(["tar", "-tzf", published]), await command(["tar", "-tzf", archive]))
  } finally { await rm(temp, { recursive: true, force: true }) }
}
if (process.env.GITHUB_OUTPUT) await Bun.write(process.env.GITHUB_OUTPUT, (await Bun.file(process.env.GITHUB_OUTPUT).text().catch(() => "")) + `exists=${Boolean(found)}\n`)
console.log(found ? `Verified registry artifact ${name}@${pack.version}` : `Version ${pack.version} absent; publication required`)
