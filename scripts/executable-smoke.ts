import { access, open, stat } from "node:fs/promises"
import { constants } from "node:fs"
import { join } from "node:path"

const targets = {
  "linux-x64": { path: "packages/oec-linux-x64/bin/oec", magic: [0x7f, 0x45, 0x4c, 0x46], executable: true },
  "win32-x64": { path: "packages/oec-win32-x64/bin/oec.exe", magic: [0x4d, 0x5a], executable: false },
} as const

const targetName = process.argv[2] ?? `${process.platform}-${process.arch}`
const target = targets[targetName as keyof typeof targets]
if (!target) {
  console.error(`Unsupported smoke target: ${targetName}. Use one of: ${Object.keys(targets).join(", ")}.`)
  process.exit(1)
}

const executablePath = join(import.meta.dir, "..", target.path)
try {
  const file = await open(executablePath, "r")
  const info = await stat(executablePath)
  if (!info.isFile() || info.size === 0) throw new Error("file is missing or empty")

  try {
    const header = Buffer.alloc(target.magic.length)
    await file.read(header, 0, header.length, 0)
    if (!target.magic.every((byte, index) => header[index] === byte)) throw new Error("invalid executable header")
    if (target.executable) await access(executablePath, constants.X_OK)
  } finally {
    await file.close()
  }
} catch (error) {
  console.error(`Executable smoke check failed for ${target.path}: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

console.log(`Executable smoke check passed: ${target.path}.`)
