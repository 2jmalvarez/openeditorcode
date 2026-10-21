import assert from "node:assert/strict"
import { copyFile, mkdir, readdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createHash } from "node:crypto"
import { allowedFiles, command, directory, integrity, npm, temporary, validateBundle, validateManifest } from "./release"
import { installPackedPlugin } from "./install-check"

const output = resolve(process.argv[2] ?? join(directory, "dist/release"))
const stage = await temporary("oec-pack-")
try {
  const manifest = await Bun.file(join(directory, "package.json")).json()
  validateManifest(manifest)
  const imports = validateBundle(await Bun.file(join(directory, "dist/tui.js")).text())
  await mkdir(join(stage, "dist"))
  await mkdir(output, { recursive: true })
  for (const path of allowedFiles.filter((path) => path !== "package.json")) await copyFile(join(directory, path), join(stage, path))
  assert.equal((await Bun.file(join(stage, "tui.ts")).text()).trim().split("\n").at(-1), 'export { default } from "./dist/tui.js"')
  if (process.env.GITHUB_ACTIONS === "true") {
    const commit = await command(["git", "rev-parse", "HEAD"])
    assert.equal(commit, process.env.GITHUB_SHA)
    assert.equal(await command(["git", "status", "--porcelain", "--untracked-files=no"]), "", "Release checkout has tracked modifications")
    manifest.gitHead = commit
  }
  await Bun.write(join(stage, "package.json"), JSON.stringify(manifest, null, 2) + "\n")
  for (const args of [["--dry-run", "--json"], ["--json", "--pack-destination", output]]) {
    const result = JSON.parse(await npm(["pack", ...args, "--ignore-scripts"], stage))
    assert.equal(result.length, 1)
    assert.deepEqual(result[0].files.map((file: { path: string }) => file.path).sort(), [...allowedFiles].sort(), "Unexpected tarball files")
    if (!args.includes("--dry-run")) {
      const archive = join(output, result[0].filename)
      const bytes = new Uint8Array(await Bun.file(archive).arrayBuffer())
      assert.equal(integrity(bytes), result[0].integrity)
      const entries = (await command(["tar", "-tzf", archive])).split(/\r?\n/).sort()
      assert.deepEqual(entries, allowedFiles.map((path) => `package/${path}`).sort())
      const extracted = join(stage, "extracted")
      await mkdir(extracted)
      await command(["tar", "-xzf", archive, "-C", extracted])
      const packed = await Bun.file(join(extracted, "package/package.json")).json()
      validateManifest(packed)
      validateBundle(await Bun.file(join(extracted, "package/dist/tui.js")).text())
      assert.deepEqual((await readdir(join(extracted, "package/dist"))).sort(), ["svg-font.ttf", "svg.wasm", "tui.js"])
      for (const installer of ["npm", "arborist"] as const) {
        await installPackedPlugin(archive, join(stage, `installed-${installer}`), installer)
      }
      await Bun.write(join(output, "pack.json"), JSON.stringify({ ...result[0], commit: packed.gitHead ?? null, imports }, null, 2) + "\n")
      await Bun.write(join(output, "SHA256SUMS"), `${createHash("sha256").update(bytes).digest("hex")}  ${result[0].filename}\n`)
      console.log(`Verified isolated tarball and npm/Arborist installation without private host runtimes: ${archive} (${result[0].integrity})`)
    }
  }
} finally { await rm(stage, { recursive: true, force: true }) }
