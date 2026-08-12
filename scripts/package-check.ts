import { join } from "node:path"

type PackFile = { path: string; size: number }
type PackResult = { name: string; version: string; files: PackFile[] }

const packages = [
  { directory: ".", required: ["bin/oec.js", "bin/launcher.js", "LICENSE", "README.md", "package.json"] },
  { directory: "packages/oec-win32-x64", required: ["bin/oec.exe", "LICENSE", "README.md", "package.json"] },
  { directory: "packages/oec-linux-x64", required: ["bin/oec", "LICENSE", "README.md", "package.json"] },
]

for (const packageToCheck of packages) {
  const result = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], {
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

  const files = new Map(packed.files.map((file) => [file.path, file.size]))
  for (const required of packageToCheck.required) {
    if (!files.get(required)) {
      console.error(`Package check failed: ${packed.name} is missing non-empty ${required}.`)
      process.exit(1)
    }
  }

  console.log(`Package check passed: ${packed.name}@${packed.version} (${packed.files.length} files).`)
}
