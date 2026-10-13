import assert from "node:assert/strict"
import { join } from "node:path"
import { command, directory, npm, validateManifest, validateTag } from "./release"

const manifest = await Bun.file(join(directory, "package.json")).json()
validateManifest(manifest)
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? `opencode-editor-v${manifest.version}`
const distTag = validateTag(tag, manifest.version)
if (process.env.GITHUB_ACTIONS === "true") {
  assert.equal(process.env.GITHUB_REF, `refs/tags/${tag}`, "Publication requires the actual tag ref, including dispatch runs")
  assert.equal(await command(["git", "cat-file", "-t", `refs/tags/${tag}`]), "tag", "Release tag must be annotated")
  assert.equal(await command(["git", "rev-parse", `${tag}^{commit}`]), process.env.GITHUB_SHA)
  await command(["git", "merge-base", "--is-ancestor", process.env.GITHUB_SHA!, "origin/main"])
  assert.ok(Bun.semver.satisfies(await npm(["--version"]), ">=11.5.1"), "npm 11.5.1+ required for OIDC")
  assert.ok(Bun.semver.satisfies((await command(["node", "--version"])).replace(/^v/, ""), ">=22.14.0"))
}
console.log(`${manifest.name}@${manifest.version}: ${tag}, dist-tag=${distTag}`)
