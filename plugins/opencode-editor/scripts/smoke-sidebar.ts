import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { directory, temporary } from "./release"

// Development smoke of the built checkout, not a packed-package/release check.
// Everything the host can write is isolated; never connect to the shared service.
const executable = process.argv[2]
assert.ok(executable, "Pass an OpenCode 2 executable; build the plugin first")
const sandbox = await temporary("oec-sidebar-host-")
const project = join(sandbox, "project")
const observer = join(sandbox, "observer")
const marker = join(sandbox, "result.json")
await mkdir(join(project, "nested"), { recursive: true })
await mkdir(observer)
await writeFile(join(project, "nested", "hello.ts"), "const original = true\n")
await writeFile(join(sandbox, "gitconfig"), "")
const gitEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(sandbox, "gitconfig"), GIT_TERMINAL_PROMPT: "0" }
async function git(args: string[]) {
  const child = Bun.spawn(["git", "-c", `core.hooksPath=${join(sandbox, "no-hooks")}`, ...args], { cwd: project, env: gitEnv, stdout: "ignore", stderr: "pipe" })
  const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()])
  assert.equal(code, 0, error)
}
const timeout = new AbortController()
const timer = setTimeout(() => timeout.abort(), 60_000)
try {
  await git(["init", "--quiet"])
  await git(["add", "."])
  await git(["-c", "user.name=OEC smoke", "-c", "user.email=oec@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Temporary fixture"])
  await writeFile(join(project, "nested", "hello.ts"), "const changed = true\n")
  await writeFile(join(observer, "package.json"), JSON.stringify({ name: "oec-sidebar-observer", type: "module", exports: { "./tui": "./tui.ts" } }))
  await writeFile(join(observer, "tui.ts"), `
import { writeFileSync } from "node:fs"
export default { id: "oec.sidebar-smoke", setup(context) {
  let disposed = false
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const all = (node = context.renderer.root) => [node, ...node.getChildren().flatMap(child => all(child))]
  const find = id => context.renderer.root.findDescendantById(id)
  const text = node => all(node).map(child => child.plainText ?? "").join("\\n")
  const until = async (predicate, label) => {
    for (let i = 0; i < 80; i++) { if (predicate()) return; if (disposed) throw new Error("Disposed"); await sleep(100) }
    throw new Error(label + " [mode=" + context.keymap.mode.current() + ", focus=" + context.renderer.currentFocusedRenderable?.id + "]")
  }
  const key = (name, modifiers = {}) => context.renderer.keyInput.processParsedKey({ name, ctrl: false, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: name === "return" ? "\\r" : name, raw: name === "return" ? "\\r" : name, ...modifiers })
  const type = value => { for (const character of value) key(character === " " ? "space" : character, { sequence: character, raw: character }) }
  const mouse = (target, release) => context.renderer.stdin.emit("data", Buffer.from("\\x1b[<0;" + (target.screenX + 2) + ";" + (target.screenY + 1) + (release ? "m" : "M")))
  const click = async target => { mouse(target, false); await sleep(40); mouse(target, true); await sleep(100) }
  const start = setTimeout(async () => {
    let stage = "session"
    try {
      context.renderer.resize(160, 50)
      context.renderer.useMouse = true
      const session = await context.client.session.create({ location: { directory: ${JSON.stringify(project)} } })
      await context.data.session.sync(session.id)
      context.ui.router.navigate({ type: "session", sessionID: session.id })
      await until(() => find("oec-files-toggle") && context.renderer.currentFocusedEditor, "Session sidebar/prompt missing")
      await sleep(300)
      const prompt = context.renderer.currentFocusedEditor
      const base = context.keymap.mode.current()
      stage = "consent click"
      mouse(find("oec-files-toggle"), false)
      await sleep(250)
      if (context.keymap.mode.current() !== base) throw new Error("Consent opened before mouse release")
      mouse(find("oec-files-toggle"), true)
      await until(() => context.keymap.mode.current() !== base, "Consent did not remain open after mouse release")
      await sleep(400)
      if (context.keymap.mode.current() === base || find("oec-files-pane")) throw new Error("Consent disappeared or accessed files early")
      key("return")
      await until(() => find("oec-files-pane"), "Consent did not open Files")
      await sleep(200)
      if (!find("oec-files-pane").focused) throw new Error("Consent did not leave the tree keyboard-accessible")
      stage = "chat focus"
      await click(prompt)
      type("chat-with-files-open")
      await sleep(500)
      if (!prompt.plainText.includes("chat-with-files-open") || !prompt.focused) throw new Error("Files stole chat focus")
      key("f7")
      await until(() => !find("oec-files-pane"), "F7 did not hide Files")
      key("f7")
      await until(() => find("oec-files-pane")?.focused, "F7 did not restore keyboard access to Files")
      key("escape")
      await until(() => prompt.focused, "Escape from Files did not restore chat focus")
      stage = "quick search"
      await click(find("oec-files-search"))
      type("HELLO")
      await until(() => find("oec-files-search")?.value === "HELLO" && !find("oec-files-pane"), "Search did not capture typing")
      await until(() => all().some(node => node.plainText?.includes("nested") && node.plainText?.includes("hello.ts") && !node.plainText?.includes("M nested")), "Search did not find a closed-folder file")
      key("return")
      await until(() => find("oec-editor-buffer"), "Search Enter did not open editor")
      if (!find("oec-editor-buffer").plainText.includes("changed")) throw new Error("Wrong search result")
      key("f6")
      await until(() => find("oec-files-search"), "Conversation did not restore sidebar")
      await click(find("oec-files-search"))
      key("escape")
      await until(() => find("oec-files-pane")?.focused, "Escape did not return to tree")
      stage = "native diff"
      await until(() => text(find("oec-changes-pane")).includes("hello.ts"), "Changes API did not populate")
      key("tab")
      await until(() => find("oec-changes-pane")?.focused, "Tab did not focus changes")
      key("return")
      await until(() => context.renderer.currentFocusedRenderable?.id === "session-panel" && text(context.renderer.root).includes("const original = true"), "Enter did not open native diff")
      if (!context.keymap.commands().some(command => command.id === "diff.close")) throw new Error("Native diff command missing")
      context.keymap.dispatch("diff.close")
      await until(() => find("oec-changes-pane"), "Native diff did not close")
      stage = "live changes"
      writeFileSync(${JSON.stringify(join(project, "new.txt"))}, "new file\\n")
      await until(() => text(find("oec-changes-pane")).includes("new.txt"), "Live changes did not refresh")
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: true, version: context.app.version }))
    } catch (error) {
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: false, stage, error: String(error), text: text(context.renderer.root).slice(-12000) }))
    } finally { context.renderer.destroy() }
  }, 1500)
  return () => { disposed = true; clearTimeout(start) }
} }
`)
  const child = Bun.spawn([executable, "--standalone", project], {
    cwd: project, stdin: "pipe", stdout: "pipe", stderr: "pipe", signal: timeout.signal,
    env: {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
      TERM: "xterm-256color", TEMP: sandbox, TMP: sandbox, LOCALAPPDATA: sandbox, APPDATA: sandbox,
      HOME: sandbox, USERPROFILE: sandbox, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(sandbox, "gitconfig"),
      XDG_CONFIG_HOME: join(sandbox, "config"), XDG_DATA_HOME: join(sandbox, "data"), XDG_CACHE_HOME: join(sandbox, "cache"), XDG_STATE_HOME: join(sandbox, "state"),
      OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ terminal: { copy: "manual" }, plugins: [{ package: directory, options: { toggleBinding: "f6", filesBinding: "f7" } }, observer] }),
    },
  })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const result = await readFile(marker, "utf8").then((value) => JSON.parse(value), () => undefined)
  if (!result?.ok || code !== 0) {
    const diagnostics: string[] = []
    const logs = async (path: string): Promise<void> => {
      for (const item of await readdir(path, { withFileTypes: true }).catch(() => [])) {
        const file = join(path, item.name)
        if (item.isDirectory()) await logs(file)
        else if (item.name.endsWith(".log")) diagnostics.push((await readFile(file, "utf8")).slice(-3000))
      }
    }
    await logs(sandbox)
    throw new Error(`Sidebar smoke failed (${code}): ${JSON.stringify(result)}\n${stderr}\n${diagnostics.join("\n")}\n${stdout.slice(-3000)}`)
  }
  console.log(`OpenCode ${result.version}: consent mouse release, chat with Files open, quick search, native diff and live changes passed (isolated checkout smoke).`)
} finally { clearTimeout(timer); await rm(sandbox, { recursive: true, force: true }) }
