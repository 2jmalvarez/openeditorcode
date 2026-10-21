import assert from "node:assert/strict"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { directory, temporary } from "./release"
import { installPackedPlugin } from "./install-check"

// Four private TUIs reuse only their own sandbox, proving persistence across exits.
const executable = process.argv[2]
assert.ok(executable, "Pass an OpenCode executable")
const sandbox = await temporary("oec-access-host-")
const project = join(sandbox, "project")
const observer = join(sandbox, "observer")
let failed = false
try {
  await mkdir(project); await mkdir(observer)
  await writeFile(join(project, "hello.txt"), "local access fixture\n")
  const source = process.argv[3]
  if (source && !source.endsWith(".tgz")) assert.match(source, /^@2jmalvarez\/opencode-editor@\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
  const plugin = !source ? directory : source.endsWith(".tgz") ? await installPackedPlugin(resolve(source), join(sandbox, "installed"), "arborist") : source
  await writeFile(join(observer, "package.json"), JSON.stringify({ name: "oec-access-observer", type: "module", exports: { "./tui": "./tui.ts" } }))
  for (const phase of ["remember", "reuse", "forget", "ask-again"]) {
    const marker = join(sandbox, `${phase}.json`)
    await writeFile(join(observer, "tui.ts"), `
import { writeFileSync } from "node:fs"
export default { id: "oec.access-observer", setup(context) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const phase = ${JSON.stringify(phase)}
  const find = id => context.renderer.root.findDescendantById(id)
  const until = async (predicate, label) => {
    for (let i = 0; i < 160; i++) { if (predicate()) return; await sleep(100) }
    throw new Error(label)
  }
  const key = name => context.renderer.keyInput.processParsedKey({ name, ctrl: false, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: name === "return" ? "\\r" : name, raw: name === "return" ? "\\r" : name })
  const start = setTimeout(async () => {
    try {
      await until(() => context.keymap.commands().some(command => command.id === "oec.files"), "Plugin did not load")
      const session = await context.client.session.create({ location: { directory: ${JSON.stringify(project)} } })
      await context.data.session.sync(session.id)
      context.renderer.resize(160, 40)
      context.ui.router.navigate({ type: "session", sessionID: session.id })
      await until(() => find("oec-files-toggle"), "Session not ready")
      const base = context.keymap.mode.current()
      context.keymap.dispatch("oec.files")
      if (phase === "remember" || phase === "ask-again") {
        await until(() => context.keymap.mode.current() !== base, "Consent missing")
        if (find("oec-files-pane")) throw new Error("Files opened without consent")
        if (phase === "remember") { key("down"); key("return") }
        else { key("escape"); await sleep(200); if (find("oec-files-pane")) throw new Error("Escape granted access") }
      }
      if (phase !== "ask-again") await until(() => find("oec-tree-0"), "Remembered access did not survive TUI exit or initial tree refresh")
      if (phase === "forget") {
        const before = context.keymap.mode.current()
        context.keymap.dispatch("oec.access.forget")
        await until(() => context.keymap.mode.current() !== before, "Forget palette command missing")
        key("return")
        await sleep(300)
        key("return")
        await sleep(500)
        if (!find("oec-files-pane")) throw new Error("Forget closed the existing workspace")
      }
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: true, version: context.app.version }))
    } catch (error) { writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: false, error: String(error) })) }
    finally { context.renderer.destroy() }
  }, 1000)
  return () => clearTimeout(start)
} }
`)
    const child = Bun.spawn([executable, "--standalone", project], {
      cwd: project, stdin: "pipe", stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(60_000),
      env: {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        TERM: "xterm-256color", TEMP: sandbox, TMP: sandbox, LOCALAPPDATA: sandbox, APPDATA: sandbox,
        HOME: sandbox, USERPROFILE: sandbox,
        XDG_CONFIG_HOME: join(sandbox, "config"), XDG_DATA_HOME: join(sandbox, "data"), XDG_CACHE_HOME: join(sandbox, "cache"), XDG_STATE_HOME: join(sandbox, "state"),
        OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ plugins: [{ package: plugin }, observer] }),
      },
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    const result = await readFile(marker, "utf8").then((value) => JSON.parse(value), () => undefined)
    assert.ok(code === 0 && result?.ok, `${phase}: ${JSON.stringify(result)}\n${stderr}\n${stdout.slice(-2000)}`)
    console.log(`OpenCode ${result.version}: local access ${phase} passed`)
  }
} catch (error) {
  failed = true
  throw error
} finally {
  try { await rm(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }) }
  catch (error) {
    if (!failed) throw error
    console.error(`Access smoke sandbox cleanup also failed: ${String(error)}`)
  }
}
