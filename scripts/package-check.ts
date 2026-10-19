import { join } from "node:path"
import { packagePolicies, validatePackageFiles, type PackFile } from "./package-policy"

type PackResult = { name: string; version: string; files: PackFile[] }

for (const packageToCheck of packagePolicies) {
  const result = Bun.spawnSync(["npm", "pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: join(import.meta.dir, "..", packageToCheck.directory),
    stdout: "pipe",
    stderr: "inherit",
  })

  if (!result.success) process.exit(result.exitCode)

  let packed: PackResult
  try {
    ;[packed] = JSON.parse(result.stdout.toString()) as PackResult[]
  } catch {
    console.error(`Package check failed: npm returned invalid JSON for ${packageToCheck.directory}.`)
    process.exit(1)
  }

  if (!packed) {
    console.error(`Package check failed: npm returned no package for ${packageToCheck.directory}.`)
    process.exit(1)
  }

  validatePackageFiles(packed.files, packageToCheck.required)

  console.log(`Package check passed: ${packed.name}@${packed.version} (${packed.files.length} files).`)
}
