import assert from "node:assert/strict"
import { mkdir, readFile, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { name, npm, registry, validateBundle, validateManifest } from "./release"

export function validateInstalledNames(names: string[]) {
  assert.deepEqual([...names].sort(), [name], "Installation must contain only the plugin, without private host runtimes or transitive dependencies")
}

/** Install the actual archive using normal peer resolution, never --legacy-peer-deps. */
export async function installPackedPlugin(archive: string, destination: string, installer: "npm" | "arborist") {
  await mkdir(destination, { recursive: true })
  await Bun.write(join(destination, "package.json"), JSON.stringify({ name: "oec-install-check", private: true, type: "module" }))
  if (installer === "npm") {
    await npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", "--save-exact", `--registry=${registry}`, `--@2jmalvarez:registry=${registry}`, resolve(archive)], destination)
  } else {
    // @ts-expect-error Arborist has no bundled TypeScript declarations.
    const { default: Arborist } = await import("@npmcli/arborist")
    await new Arborist({ path: destination, ignoreScripts: true, audit: false, progress: false, registry, "@2jmalvarez:registry": registry }).reify({ add: [resolve(archive)], save: true, saveType: "prod" })
  }
  const installed: string[] = []
  async function packages(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      assert.ok(!entry.isSymbolicLink(), "Installation must not link back to a checkout")
      if (!entry.isDirectory()) continue
      const path = join(directory, entry.name)
      if (entry.name.startsWith("@")) { await packages(path); continue }
      const manifest = JSON.parse(await readFile(join(path, "package.json"), "utf8"))
      installed.push(manifest.name)
      const nested = join(path, "node_modules")
      if (await Bun.file(join(path, "package.json")).exists()) {
        const entries = await readdir(nested).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error })
        if (entries) await packages(nested)
      }
    }
  }
  await packages(join(destination, "node_modules"))
  validateInstalledNames(installed)
  const plugin = join(destination, "node_modules", name)
  validateManifest(await Bun.file(join(plugin, "package.json")).json())
  validateBundle(await Bun.file(join(plugin, "dist/tui.js")).text())
  return plugin
}
