import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import assert from "node:assert/strict"
import { allowedFiles, command, temporary as createTemporary, validateBundle, validateManifest } from "./release"
import { installPackedPlugin } from "./install-check"

// Explicit executable avoids shell wrappers. No user config, service, sessions, or credentials are touched.
const executable = process.argv[2]
if (!executable) throw new Error("Pass the path to an OpenCode 2 executable")
const source = process.argv[3]
const automaticRoot = process.argv[4] === "--auto-root"
if (!source) throw new Error("Pass a packed .tgz or @2jmalvarez/opencode-editor@<version>; checkout loading is not a release test")
const temporary = await createTemporary("oec-host-")
const project = join(temporary, "project")
const wrapper = join(temporary, "plugin")
const marker = join(temporary, "ready.json")
let pluginSource = source
if (source.endsWith(".tgz")) {
  const archive = resolve(source)
  const entries = (await command(["tar", "-tzf", archive])).split(/\r?\n/).sort()
  assert.deepEqual(entries, allowedFiles.map((path) => `package/${path}`).sort())
  pluginSource = await installPackedPlugin(archive, join(temporary, "installed"), "arborist")
  validateManifest(await Bun.file(join(pluginSource, "package.json")).json())
  validateBundle(await Bun.file(join(pluginSource, "dist/tui.js")).text())
} else assert.match(source, /^@2jmalvarez\/opencode-editor@\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
await mkdir(project)
await mkdir(wrapper)
await writeFile(join(project, "hello.txt"), "OEC host smoke file")
await writeFile(join(project, "second.txt"), "Second document")
await writeFile(join(wrapper, "package.json"), JSON.stringify({ name: "oec-smoke-wrapper", type: "module", exports: { "./tui": "./tui.ts" } }))
await writeFile(join(wrapper, "tui.ts"), `
import { writeFileSync, readFileSync } from "node:fs"
export default {
  id: "oec.smoke-observer",
  async setup(context) {
    // Never write the user's clipboard, even if a host changes selection behavior.
    let copied
    context.renderer.copyToClipboardOSC52 = text => { copied = text; return true }
    writeFileSync(${JSON.stringify(join(temporary, "loaded.json"))}, JSON.stringify({ stage: "setup", options: context.options }))
    let sessionID
    const waitFor = async (predicate, label) => {
      for (let attempt = 0; attempt < 240; attempt++) {
        if (predicate()) return
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      throw new Error(label)
    }
    const start = setTimeout(async () => {
      try {
     // A slow/failed npm install must never send Enter into the chat.
        await waitFor(() => context.keymap.commands().some(command => command.id === "oec.files"), "OEC did not load; no keys sent")
        const session = await context.client.session.create({ location: { directory: ${JSON.stringify(project)} } })
        sessionID = session.id
        await context.data.session.sync(sessionID)
        context.renderer.resize(160, 30)
        context.ui.router.navigate({ type: "session", sessionID })
        await waitFor(() => context.ui.router.current().type === "session" && context.keymap.commands().some(command => command.id === "oec.files"), "Session/OEC files command unavailable")
        await new Promise(resolve => setTimeout(resolve, 250))
        if (!context.keymap.commands().some(command => command.id === "oec.files")) throw new Error("OEC unloaded; no keys sent")
        const mode = context.keymap.mode.current()
         context.keymap.dispatch("oec.files")
        if (${automaticRoot}) {
          await waitFor(() => context.keymap.mode.current() !== mode, "Local access confirmation did not open; Enter not sent")
          key("return")
        }
      } catch (error) {
        writeFileSync(${JSON.stringify(join(temporary, "loaded.json"))}, JSON.stringify({ stage: "startup failed", error: String(error) }))
        clearInterval(timer)
        context.renderer.destroy()
      }
    }, 1500)
    let stage = 0
    let result
    const key = (name, modifiers = {}) => context.renderer.keyInput.processParsedKey({ name, ctrl: false, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: name === "return" ? "\\r" : name, raw: name === "return" ? "\\r" : name, ...modifiers })
    const timer = setInterval(() => {
      try {
      writeFileSync(${JSON.stringify(join(temporary, "loaded.json"))}, JSON.stringify({ stage, route: context.ui.router.current(), text: context.renderer.root.findDescendantById("oec-editor-buffer")?.plainText, disk: readFileSync(${JSON.stringify(join(project, "hello.txt"))}, "utf8") }))
      if (stage === 0 && context.renderer.root.findDescendantById("oec-tree-0")) {
        stage = 1
        context.renderer.keyInput.processParsedKey({ name: "return", ctrl: false, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: "\\r", raw: "\\r" })
      } else if (stage === 1) {
        const buffer = context.renderer.root.findDescendantById("oec-editor-buffer")
        if (!buffer) return
        stage = 4
         if (!buffer.focused) throw new Error("Opening a file did not focus the editor")
         key("tab")
      } else if (stage === 4) {
        const buffer = context.renderer.root.findDescendantById("oec-editor-buffer")
        if (!buffer) return
         stage = 8
          if (buffer.focused) throw new Error("Tab did not change to the files panel")
          key("tab")
      } else if (stage === 8) {
         stage = 9
         if (context.renderer.root.findDescendantById("oec-editor-buffer")?.focused) throw new Error("Tab skipped the visible Diff panel")
         key("tab")
      } else if (stage === 9) {
         const buffer = context.renderer.root.findDescendantById("oec-editor-buffer")
         if (!buffer) return
         stage = 2
         if (!buffer.focused) throw new Error("Tab did not return to the editor")
        context.renderer.keyInput.processParsedKey({ name: "home", ctrl: true, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: "home", raw: "home" })
        for (const character of "edited ") context.renderer.keyInput.processParsedKey({ name: character === " " ? "space" : character, ctrl: false, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: character, raw: character })
        if (!buffer.plainText.includes("edited ")) throw new Error("Editor did not receive typed characters")
        const original = buffer.plainText
        key("return")
        if (buffer.plainText !== original.replace("edited ", "edited \\n")) throw new Error("Enter did not insert exactly one newline")
        key("down", { shift: true, meta: true })
        if (buffer.plainText !== "edited \\nOEC host smoke file\\nOEC host smoke file") throw new Error("Shift+Alt+Down did not duplicate the current line: " + JSON.stringify(buffer.plainText))
        key("up", { meta: true })
        key("home", { ctrl: true })
        key("right", { ctrl: true, shift: true })
        if (!buffer.getSelectedText()) throw new Error("Ctrl+Shift+Right did not select text")
         key("c", { ctrl: true })
        if (copied !== buffer.getSelectedText()) throw new Error("Ctrl+C did not copy the selected text")
        key("a", { ctrl: true })
        if (buffer.getSelectedText() !== buffer.plainText) throw new Error("Ctrl+A did not select all")
        key("end", { ctrl: true })
        key("pageup", { shift: true })
        if (!buffer.getSelectedText()) throw new Error("Shift+PageUp did not extend selection")
        key("home", { ctrl: true })
        key("pagedown")
        if (buffer.logicalCursor.row === 0) throw new Error("PageDown did not navigate the document")
        result = { version: context.app.version, route: JSON.parse(JSON.stringify(context.ui.router.current())), commands: context.keymap.commands().map(command => command.id) }
        context.renderer.keyInput.processParsedKey({ name: "s", ctrl: true, meta: false, shift: false, option: false, number: false, eventType: "press", source: "raw", sequence: "\\u0013", raw: "\\u0013" })
      } else if (stage === 2 && readFileSync(${JSON.stringify(join(project, "hello.txt"))}, "utf8").includes("edited ")) {
        stage = 3
         key("f6")
      } else if (stage === 3 && context.ui.router.current().type === "session" && context.ui.router.current().sessionID === sessionID) {
         stage = 5
         key("f6")
       } else if (stage === 5 && context.renderer.root.findDescendantById("oec-editor-buffer")) {
         const buffer = context.renderer.root.findDescendantById("oec-editor-buffer")
         if (buffer.plainText !== "edited \\nOEC host smoke file\\nOEC host smoke file") throw new Error("Document lost when toggling conversation/editor")
         stage = 6
         key("tab")
         key("down")
         key("return")
       } else if (stage === 6 && context.renderer.root.findDescendantById("oec-editor-buffer")?.plainText === "Second document") {
         stage = 7
         key("tab", { shift: true })
       } else if (stage === 7 && context.renderer.root.findDescendantById("oec-editor-buffer")?.plainText.startsWith("edited ")) {
         writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ...result, returned: true, documents: true }))
        clearInterval(timer)
        context.renderer.destroy()
      }
      } catch (error) {
        writeFileSync(${JSON.stringify(join(temporary, "loaded.json"))}, JSON.stringify({ stage, error: String(error) }))
        clearInterval(timer)
        context.renderer.destroy()
      }
    }, 250)
    return () => { clearTimeout(start); clearInterval(timer) }
  }
}
`)
const timeout = new AbortController()
const timer = setTimeout(() => timeout.abort(), 90_000)
let failed = false
try {
  const child = Bun.spawn([executable, "--standalone", project], {
    cwd: project, stdin: "pipe", stdout: "pipe", stderr: "pipe", signal: timeout.signal,
    env: {
       PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
       TERM: "xterm-256color", TEMP: temporary, TMP: temporary, LOCALAPPDATA: temporary, APPDATA: temporary,
      HOME: temporary, USERPROFILE: temporary,
      XDG_CONFIG_HOME: join(temporary, "config"), XDG_DATA_HOME: join(temporary, "data"), XDG_CACHE_HOME: join(temporary, "cache"), XDG_STATE_HOME: join(temporary, "state"),
        OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ terminal: { copy: "manual" }, plugins: [{ package: pluginSource, options: { ...(automaticRoot ? {} : { localRoot: project }), toggleBinding: "f6", filesBinding: "f7", diffBinding: "f8", explorerWidth: 30 } }, wrapper] }),
    },
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const ready = await access(marker).then(() => true, () => false)
  if (!ready) {
    const diagnostics: string[] = []
    async function logs(directory: string) {
      for (const item of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
        const path = join(directory, item.name)
        if (item.isDirectory()) await logs(path)
        else if (item.name.endsWith(".log") || item.name === "loaded.json") diagnostics.push(`${path}: ${(await readFile(path, "utf8")).slice(-8000)}`)
      }
    }
    await logs(temporary)
    throw new Error(`OpenCode host smoke failed (exit=${exitCode}): ${stderr}\n${diagnostics.join("\n")}\n${stdout.slice(-12000)}`)
  }
   const result = JSON.parse(await readFile(marker, "utf8")) as { version: string; route: { type: string; name: string }; commands: string[]; returned: boolean; documents: boolean }
   if (exitCode !== 0 || result.route.type !== "plugin" || result.route.name !== "oec.editor" || !result.commands.includes("oec.save") || !result.returned || !result.documents) throw new Error(`Invalid host state: ${JSON.stringify(result)}, exit=${exitCode}`)
   console.log(`OpenCode ${result.version}: packed plugin, editor shortcuts, Tab, typing, Enter, duplication, selection/copy, pages, Ctrl+S, session return and document tabs passed.`)
} catch (error) {
  failed = true
  throw error
} finally {
  clearTimeout(timer)
  try { await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }) }
  catch (error) {
    // A locked Windows sandbox must not replace the actual smoke diagnostic.
    if (!failed) throw error
    console.error(`Smoke sandbox cleanup also failed: ${String(error)}`)
  }
}
