import assert from "node:assert/strict"
import { chmod, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { command, download, metadata, testedHostVersions } from "./release"

const version = process.argv[2]
assert.ok(version && testedHostVersions.includes(version), "Use a tested OpenCode version")
assert.equal(process.arch, "x64")
assert.ok(process.platform === "win32" || process.platform === "linux")
const output = resolve(process.argv[3]!)
await mkdir(output, { recursive: true })
const packageName = `@opencode/cli-${process.platform === "win32" ? "windows" : "linux"}-x64`
const manifest = await metadata(packageName, version)
assert.ok(manifest, "Host package not found")
const archive = join(output, "host.tgz")
await download(manifest, archive)
await command(["tar", "-xzf", archive, "-C", output])
const executable = join(output, "package/bin", process.platform === "win32" ? "opencode.exe" : "opencode")
await chmod(executable, 0o755)
console.log(executable)
