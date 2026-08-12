import { access, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const executable = process.platform === "win32"
  ? join(import.meta.dir, "..", "packages", "oec-win32-x64", "bin", "oec.exe")
  : join(import.meta.dir, "..", "packages", "oec-linux-x64", "bin", "oec")
const root = await mkdtemp(join(tmpdir(), "oec-smoke-"))
const marker = join(root, "ready")
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15_000)

try {
  const child = Bun.spawn([executable, root], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, OEC_TUI_SMOKE: "1", OEC_TUI_SMOKE_MARKER: marker },
    signal: controller.signal,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const ready = await access(marker).then(() => true, () => false)
  if (exitCode !== 0 || !ready) {
    throw new Error(`exit=${exitCode}; stdout=${JSON.stringify(stdout)}; stderr=${JSON.stringify(stderr)}`)
  }
  console.log(`Real TUI smoke passed: ${executable}.`)
} catch (error) {
  console.error(`Real TUI smoke failed: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  await rm(root, { recursive: true, force: true })
}
