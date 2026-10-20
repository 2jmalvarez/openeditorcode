import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { factoryConfig } from "../src/config/defaults"

// Exercise the compiled executable, not the test renderer. No personal config,
// project files, terminal sessions or installed binary are changed.
const distribution = process.env.OEC_IMAGE_SMOKE_WSL
const executable = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dir, "..", "packages", process.platform === "win32" && !distribution ? "oec-win32-x64/bin/oec.exe" : "oec-linux-x64/bin/oec")
const directory = await mkdtemp(join(tmpdir(), "oec-image-smoke-"))
const project = join(directory, "project")
const configDirectory = join(directory, "config")
await mkdir(project); await mkdir(configDirectory)
await copyFile(join(import.meta.dir, "..", "docs", "images", "plugin-screen-2.png"), join(project, "preview.png"))
const config = factoryConfig()
config.appearance.language = "es"
config.preview.imageProtocol = "blocks"
await writeFile(join(configDirectory, "config.json"), JSON.stringify(config))
const linuxPath = (path: string) => {
  const match = /^([a-z]):[\\/](.*)$/i.exec(path)
  if (!match) throw new Error("WSL image smoke needs paths on a Windows drive")
  return `/mnt/${match[1]!.toLowerCase()}/${match[2]!.replace(/\\/g, "/")}`
}
// Optional Windows-side runner for the cross-compiled Linux binary; no Bun
// installation is needed inside WSL. Normal CI runs each platform natively.
const command = distribution ? ["wsl.exe", "--distribution", distribution, "--exec", "env", `OEC_CONFIG_DIR=${linuxPath(configDirectory)}`, "OEC_TUI_SMOKE=0", "OEC_INTERNAL_WORKER=0", "TERM=xterm-256color", linuxPath(executable), linuxPath(project)] : [executable, project]
const child = Bun.spawn(command, {
  stdin: "pipe", stdout: "pipe", stderr: "pipe",
  env: { ...process.env, OEC_CONFIG_DIR: configDirectory, OEC_TUI_SMOKE: "0", OEC_INTERNAL_WORKER: "0", TERM: "xterm-256color" },
})
let output = ""
let finished = false
const exited = child.exited.then((code) => { finished = true; return code })
const stdout = (async () => { for await (const chunk of child.stdout) output += new TextDecoder().decode(chunk) })()
const stderr = new Response(child.stderr).text()
const waitFor = async (predicate: () => boolean, label: string, milliseconds = 30_000) => {
  const deadline = Date.now() + milliseconds
  while (!predicate()) {
    if (finished || Date.now() > deadline) throw new Error(label)
    await Bun.sleep(50)
  }
}
try {
  await waitFor(() => output.toLowerCase().includes("explorador"), "Explorer did not start")
  child.stdin.write("\x06") // Explorer file search: Ctrl+F.
  await Bun.sleep(150)
  child.stdin.write("preview.png")
  await Bun.sleep(300)
  child.stdin.write("\r")
  await waitFor(() => output.includes("IMAGEN · SOLO LECTURA"), "Image preview did not open")
  // A one-row thumbnail paints only a handful of half-blocks. The real screenshot
  // must paint a substantial image in the available terminal area.
  await waitFor(() => (output.match(/[▀▄]/g) ?? []).length >= 40, "Image remained a thumbnail instead of filling the preview", 4000)
} catch (error) {
  process.exitCode = 1
  console.error(`Image smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  console.error(JSON.stringify(output.slice(-3000)))
} finally {
  if (!finished) { try { child.stdin.write("\x11") } catch { /* Already exited. */ } }
  const code = await Promise.race([exited, Bun.sleep(3000).then(() => undefined)])
  if (code === undefined) child.kill()
  const exitCode = await exited
  await stdout
  const diagnostics = await stderr
  if (exitCode !== 0 && !process.exitCode) {
    process.exitCode = 1
    console.error(`Image smoke executable exited with ${exitCode}`)
  }
  if (process.exitCode) console.error(diagnostics.slice(-3000))
  else console.log(`Compiled image preview smoke passed (${(output.match(/[▀▄]/g) ?? []).length} image cells): ${executable}`)
  await rm(directory, { recursive: true, force: true })
}
