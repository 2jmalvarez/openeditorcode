import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { directory, temporary } from "./release"
import { installPackedPlugin } from "./install-check"

// Without a source argument, test the built checkout. For release checks, pass
// its verified tarball or exact npm package name and use the real host loader.
// Everything the host can write is isolated; never connect to the shared service.
const executable = process.argv[2]
assert.ok(executable, "Pass an OpenCode 2 executable; build the plugin first")
const sandbox = await temporary("oec-sidebar-host-")
const project = join(sandbox, "project")
const observer = join(sandbox, "observer")
const marker = join(sandbox, "result.json")
const source = process.argv[3]
await mkdir(join(project, "nested"), { recursive: true })
await mkdir(join(project, "crowded"))
await Promise.all(Array.from({ length: 100 }, (_, index) => writeFile(join(project, "crowded", `entry-${String(index).padStart(3, "0")}.ts`), "fixture\n")))
await mkdir(observer)
await writeFile(join(project, "nested", "hello.ts"), "const original = true\n")
await writeFile(join(project, "README.md"), "# Preview smoke\n\n**Formatted** Markdown.\n")
await writeFile(join(project, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><desc>svg_content_smoke</desc><rect width="24" height="12" fill="red"/></svg>')
await writeFile(join(project, "pixel.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64"))
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
  if (source && !source.endsWith(".tgz")) assert.match(source, /^@2jmalvarez\/opencode-editor@\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
  const pluginSource = !source ? directory : source.endsWith(".tgz")
    ? await installPackedPlugin(resolve(source), join(sandbox, "installed"), "arborist") : source
  await git(["init", "--quiet"])
  await git(["add", "."])
  await git(["-c", "user.name=OEC smoke", "-c", "user.email=oec@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Temporary fixture"])
  await writeFile(join(project, "nested", "hello.ts"), "const changed = true\n")
  await writeFile(join(observer, "package.json"), JSON.stringify({ name: "oec-sidebar-observer", type: "module", exports: { "./tui": "./tui.tsx" } }))
  await writeFile(join(observer, "tui.tsx"), `/** @jsxImportSource @opentui/solid */
import { writeFileSync } from "node:fs"
import { ScrollBoxRenderable } from "@opentui/core"
export default { id: "oec.sidebar-smoke", setup(context) {
  const removeContext = context.ui.slot({ prepend: "sidebar.content", render: () => <box height={9} flexShrink={0}><text>{"Context: 12% used\\nMCP\\nserver 1: connected\\nserver 2: connected\\nserver 3: connected\\nserver 4: connected\\nserver 5: connected\\nserver 6: connected"}</text></box> })
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
   const click = async target => { await sleep(100); mouse(target, false); await sleep(40); mouse(target, true); await sleep(100) }
   const wheel = async (target, direction, count = 6) => {
     for (let i = 0; i < count; i++) {
       context.renderer.stdin.emit("data", Buffer.from("\\x1b[<" + (direction === "down" ? 65 : 64) + ";" + (target.screenX + 3) + ";" + (target.screenY + 3) + "M"))
       await sleep(40)
     }
     await sleep(150)
   }
   const start = setTimeout(async () => {
    let stage = "session"
    try {
      context.renderer.resize(160, 50)
      context.renderer.useMouse = true
      const session = await context.client.session.create({ location: { directory: ${JSON.stringify(project)} } })
      await context.data.session.sync(session.id)
      context.ui.router.navigate({ type: "session", sessionID: session.id })
       await until(() => find("oec-files-toggle") && context.renderer.currentFocusedEditor, "Session sidebar/prompt missing")
       if (!find("oec-diff-toggle") || find("oec-files-pane") || find("oec-changes-pane")) throw new Error("Initial Files and Diff headers must render before authorization, without reading disk")
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
        stage = "independent accordions"
         await until(() => find("oec-changes-pane"), "Diff must be visible by default")
         if (!find("oec-files-pane")) throw new Error("Default Diff hid Files")
         stage = "expanded panel geometry"
         const outerScroll = () => { let node = find("oec-project-panels").parent; while (node && !(node instanceof ScrollBoxRenderable)) node = node.parent; return node }
         const balanced = () => find("oec-files-scroll").viewport.height === find("oec-diff-scroll").viewport.height && find("oec-files-scroll").verticalScrollBar.screenX === find("oec-diff-scroll").verticalScrollBar.screenX
         const fillsSidebar = () => { const outer = outerScroll(); return outer && outer.scrollHeight <= outer.viewport.height && find("oec-project-panels").screenY + find("oec-project-panels").height === outer.viewport.screenY + outer.viewport.height }
         await until(() => balanced() && fillsSidebar(), "Expanded panels do not share/fill the actual host viewport")
         for (const rows of [40, 60, 50]) {
           context.renderer.resize(160, rows)
           await until(() => balanced() && fillsSidebar(), "Expanded panels did not track terminal resize")
         }
         const sharedDiffHeight = find("oec-changes-pane").height
         key("f7")
        await until(() => !find("oec-files-pane") && !find("oec-files-toggle") && !find("oec-files-search") && find("oec-changes-pane"), "F7 must hide Files including its header, not just collapse it")
         if (find("oec-panels-gap")) throw new Error("Hidden Files left an empty separator")
         await until(() => find("oec-changes-pane").height > sharedDiffHeight && fillsSidebar(), "Diff did not fill space after hiding Files")
        key("f7")
        await until(() => find("oec-files-pane") && find("oec-changes-pane"), "F7 did not restore Files")
       await click(find("oec-diff-toggle"))
        await until(() => !find("oec-changes-pane") && find("oec-diff-toggle"), "Diff accordion did not collapse")
         await until(() => find("oec-files-section").height > sharedDiffHeight && fillsSidebar(), "Files did not fill space after collapsing Diff")
        await click(find("oec-files-toggle"))
        await until(() => !find("oec-files-pane"), "Files accordion did not collapse")
         if (!find("oec-files-toggle")) throw new Error("Collapsing must keep the Files header")
         await until(() => find("oec-project-panels").height === 3, "Collapsed panels reserve empty expanded space")
       await click(find("oec-diff-toggle"))
       await until(() => find("oec-changes-pane") && !find("oec-files-pane"), "Accordions are not independent")
       await click(find("oec-files-toggle"))
        await until(() => find("oec-files-pane"), "Files accordion did not expand")
         stage = "panel height setting"
         const togglePanelHeight = async () => {
           context.keymap.dispatch("oec.settings")
           await until(() => text(context.renderer.root).includes("Panel height:"), "Panel height setting missing")
           for (let i = 0; i < 4; i++) key("down")
           key("return")
         }
         await togglePanelHeight()
         await until(() => find("oec-changes-pane").height <= 8 && find("oec-files-section").height <= 11, "Compact setting did not restore bounded heights")
         await togglePanelHeight()
         await until(() => balanced() && fillsSidebar(), "Expanded setting did not restore full sidebar height")
       stage = "large search clipping"
       await click(find("oec-files-search"))
       type("entry")
       await until(() => text(find("oec-files-pane")).includes("entry-"), "Large search did not populate tree")
       for (let i = 0; i < 85; i++) key("down")
       await sleep(200)
       if (find("oec-files-pane").screenY + find("oec-files-pane").height > find("oec-diff-toggle").screenY) throw new Error("Files overlaps Diff after large search")
        if (!text(find("oec-files-pane")).includes("entry-079")) throw new Error("Search selection did not scroll within its viewport")
        stage = "Files manual scrolling"
        const filesScroll = find("oec-files-scroll")
        const filesEnd = filesScroll.scrollTop
        await wheel(filesScroll.viewport, "up")
        const manualFilesTop = filesScroll.scrollTop
        if (!(manualFilesTop < filesEnd)) throw new Error("Files wheel snapped back to selected last result")
        key("f5")
        await sleep(700)
        if (filesScroll.scrollTop !== manualFilesTop) throw new Error("Refreshing search reset manual Files scrolling")
        key("down")
        await until(() => filesScroll.scrollTop === filesEnd, "Keyboard at last search result did not reveal selection")
       key("escape")
       await until(() => find("oec-files-pane")?.focused, "Search Escape did not focus Files")
        key("f8")
        await until(() => !find("oec-diff-toggle") && find("oec-files-pane"), "F8 did not hide only Diff")
       key("escape")
      await until(() => prompt.focused, "Escape from Files did not restore chat focus")
      stage = "quick search"
      await click(find("oec-files-search"))
      type("HELLO")
       await until(() => find("oec-files-search")?.value === "HELLO" && find("oec-files-pane"), "Search did not retain the tree")
       await until(() => text(find("oec-files-pane")).includes("nested") && text(find("oec-files-pane")).includes("hello.ts"), "Search did not find a closed-folder file in its tree")
        if (text(find("oec-files-pane")).includes("nested/hello.ts")) throw new Error("Search returned a flat path instead of a tree")
       key("e", { ctrl: true })
       await until(() => text(context.renderer.root).includes("Literal ^F"), "Ctrl+E did not enable literal search")
       key("e", { ctrl: true })
       await until(() => text(context.renderer.root).includes("Fuzzy ^F"), "Ctrl+E did not restore fuzzy search")
      key("return")
      await until(() => find("oec-editor-buffer"), "Search Enter did not open editor")
        if (!find("oec-editor-buffer").plainText.includes("changed")) throw new Error("Wrong search result")
        const sourceCommands = context.keymap.commands().filter(command => command.id?.startsWith("oec."))
        if (sourceCommands.some(command => command.palette && (command.title?.startsWith("OEC:") || command.group !== "OEC: opencode-editor"))) throw new Error("Palette repeats OEC prefix or has wrong group")
        for (const id of ["oec.save", "oec.find", "oec.wrap", "oec.focus"]) if (!context.keymap.shortcuts(id).length) throw new Error("Missing displayed shortcut: " + id)
       stage = "F6 search and wrap"
       await until(() => find("oec-files-search") && find("oec-files-pane"), "F6 search/tree missing")
        if (find("oec-diff-toggle")) throw new Error("Opening a file changed hidden Diff visibility")
        key("f8")
        await until(() => find("oec-changes-pane"), "F8 did not show Diff in the editor")
       await sleep(150)
       if (find("oec-files-pane").screenY + find("oec-files-pane").height > find("oec-diff-toggle").screenY) throw new Error("Editor Files overlaps Diff")
        key("f8")
        await until(() => !find("oec-diff-toggle") && find("oec-files-pane"), "Editor F8 did not hide only Diff")
       const buffer = find("oec-editor-buffer")
       const content = buffer.plainText
       key("l", { ctrl: true })
       await until(() => buffer.wrapMode === "word", "Ctrl+L did not enable wrap")
       if (buffer.plainText !== content) throw new Error("Wrapping modified the file")
       key("tab")
       await until(() => find("oec-files-pane")?.focused, "F6 tree could not receive focus")
       key("/")
       await until(() => find("oec-files-search")?.focused, "F6 slash did not focus file search")
       if (find("oec-files-search").value !== "HELLO") throw new Error("Search query lost on route change")
       key("escape")
       await until(() => find("oec-files-pane")?.focused && find("oec-files-search")?.value === "", "F6 Escape did not clear search")
        stage = "local diff tab from editor"
        key("f8")
       await until(() => find("oec-changes-pane") && text(find("oec-changes-pane")).includes("hello.ts"), "Editor Diff did not populate")
       key("tab")
        await until(() => find("oec-changes-pane")?.focused, "Editor Diff did not receive keyboard focus")
        if (!text(find("oec-changes-pane")).includes("nested") || text(find("oec-changes-pane")).includes("nested/hello.ts")) throw new Error("Diff is not a folder tree")
        key("left")
        await until(() => !text(find("oec-changes-pane")).includes("hello.ts"), "Left did not collapse Diff folder")
        key("right")
        await until(() => text(find("oec-changes-pane")).includes("hello.ts"), "Right did not expand Diff folder")
         key("down") // repository branch
         key("down") // nested folder
         key("down") // changed file
        key("return")
        await until(() => find("oec-diff-view") && context.ui.router.current().type === "plugin", "Editor Diff did not open a plugin tab")
        await until(() => text(find("oec-diff-view")).includes("const original = true") && text(find("oec-diff-view")).includes("const changed = true"), "Diff tab did not render both versions")
        context.keymap.dispatch("oec.diff.layout")
        await until(() => find("oec-diff-view")?.view === "unified", "Unified diff setting did not apply")
        context.keymap.dispatch("oec.diff.layout")
        await until(() => find("oec-diff-view")?.view === "split", "Split diff setting did not apply")
        if (!find("oec-changes-pane")) throw new Error("Opening a diff hid the Diff accordion")
        key("f4")
        await until(() => find("oec-editor-buffer"), "F4 did not open editable file")
        if (find("oec-editor-buffer").plainText !== content) throw new Error("Diff/F4 lost the document")
       key("f6")
        await until(() => context.ui.router.current().type === "session" && find("oec-files-search") && !find("oec-editor-buffer"), "Conversation did not restore sidebar")
        for (const id of ["oec.conversation.save", "oec.conversation.find", "oec.conversation.wrap", "oec.conversation.focus"]) if (!context.keymap.commands().some(command => command.id === id && command.group === "OEC: opencode-editor")) throw new Error("Conversation palette action missing: " + id)
       await sleep(200)
       await click(find("oec-files-search"))
       type("HELLO")
       await until(() => text(find("oec-files-pane")).includes("hello.ts"), "Sidebar search did not restore results")
       key("escape")
      await until(() => find("oec-files-pane")?.focused, "Escape did not return to tree")
        stage = "local diff tab from sidebar"
        if (!find("oec-changes-pane")) throw new Error("F6 must preserve visible Diff when returning to conversation")
       await until(() => text(find("oec-changes-pane")).includes("hello.ts"), "Local Git did not populate")
      key("tab")
        await until(() => find("oec-changes-pane")?.focused, "Tab did not focus changes")
        key("home")
        key("down") // repository branch
        key("down") // nested folder
        key("down") // changed file
       key("return")
       await until(() => find("oec-diff-view") && context.ui.router.current().type === "plugin", "Sidebar Enter did not open diff tab")
       key("f4")
       await until(() => find("oec-editor-buffer"), "F4 did not restore current file")
       stage = "rename with F2"
       key("tab")
       await until(() => find("oec-files-pane")?.focused, "Files did not focus")
       key("/")
       await until(() => find("oec-files-search")?.focused, "Search did not focus")
       type("hello")
       await until(() => text(find("oec-files-pane")).includes("hello.ts"), "Rename search failed")
       key("tab")
       await until(() => find("oec-files-pane")?.focused, "Rename selection did not focus Files")
       key("f2")
       await until(() => context.keymap.mode.current() !== "oec-editor", "F2 did not open rename prompt")
       await sleep(150)
       type("renamed.ts")
       key("return")
       await until(() => text(find("oec-changes-pane")).includes("renamed.ts"), "Rename did not refresh Git")
       const openSearch = async query => {
         await click(find("oec-files-search"))
         key("escape")
         await until(() => find("oec-files-pane")?.focused, "Search reset did not focus tree")
         key("/")
         await until(() => find("oec-files-search")?.focused, "Search field missing")
         type(query)
         await until(() => text(find("oec-files-pane")).toLowerCase().includes(query.toLowerCase()), "Query missing: " + query)
         key("return")
       }
       stage = "Markdown F4"
       await openSearch("README.md")
       await until(() => find("oec-markdown-preview"), "Markdown preview missing")
       key("f4")
       await until(() => find("oec-editor-buffer")?.plainText.includes("Preview smoke"), "F4 did not edit Markdown")
       key("f4")
       await until(() => find("oec-markdown-preview") && !find("oec-editor-buffer"), "F4 did not restore preview")
        stage = "image preview"
        await openSearch("icon.svg")
        await until(() => find("oec-image-preview")?.image?.width === 24, "Packed SVG assets did not render")
        key("f4")
        await until(() => find("oec-editor-buffer")?.plainText.includes("svg_content_smoke"), "SVG F4 did not edit XML")
        key("f4")
        await until(() => find("oec-image-preview")?.image?.width === 24, "SVG F4 did not restore preview")
        await click(find("oec-files-search"))
        key("escape")
        await until(() => find("oec-files-pane")?.focused, "Content reset failed")
        key("/")
        await until(() => find("oec-files-search")?.focused, "Content search not focused")
        key("f", { ctrl: true })
        type("svg_content_smoke")
        await until(() => text(find("oec-files-pane")).includes("icon.svg"), "Content query did not match SVG text")
        if (!context.keymap.commands().some(command => command.id === "oec.search.target" && command.palette)) throw new Error("Content palette action missing")
        key("f", { ctrl: true })
        await openSearch("pixel.png")
       await until(() => find("oec-image-preview"), "Image preview missing")
       await until(() => find("oec-image-preview")?.image || find("oec-image-preview")?.loadError, "Image did not load")
       if (find("oec-image-preview")?.loadError) throw new Error("Image decoding failed")
       stage = "palette references"
       if (!context.keymap.commands().some(command => command.id === "oec.help") || !context.keymap.commands().some(command => command.id === "oec.settings")) throw new Error("OEC help/settings missing in palette")
       context.keymap.dispatch("oec.help")
       await until(() => text(context.renderer.root).includes("OEC shortcuts") && context.keymap.mode.current() !== "oec-editor", "Shortcut reference did not open")
       key("escape")
       await until(() => context.keymap.mode.current() === "oec-editor", "Shortcut reference did not close")
       context.keymap.dispatch("oec.settings")
       await until(() => text(context.renderer.root).includes("View all options and current values"), "Settings menu did not open")
       key("return")
       await until(() => text(context.renderer.root).includes("searchMode:") && text(context.renderer.root).includes("imageProtocol:"), "Configuration reference missing options")
       key("escape")
       await until(() => context.keymap.mode.current() === "oec-editor", "Configuration reference did not close")
      stage = "live changes"
      writeFileSync(${JSON.stringify(join(project, "new.txt"))}, "new file\\n")
       await until(() => text(find("oec-changes-pane")).includes("new.txt"), "Live changes did not refresh")
       stage = "Diff manual scrolling"
       for (let i = 0; i < 60; i++) writeFileSync(${JSON.stringify(project)} + "/scroll-diff-" + String(i).padStart(3, "0") + ".txt", "new file\\n")
       await until(() => find("oec-diff-scroll")?.scrollHeight > 60, "Diff virtual tree did not grow")
       const diffScroll = find("oec-diff-scroll")
       find("oec-changes-pane").focus()
       key("home")
       await until(() => diffScroll.scrollTop === 0, "Diff Home did not reset viewport")
       await wheel(diffScroll.viewport, "down", 12)
       const manualDiffTop = diffScroll.scrollTop
       if (manualDiffTop < 10) throw new Error("Diff wheel did not move beyond overscan")
       key("f5")
       await sleep(3500)
       if (diffScroll.scrollTop !== manualDiffTop) throw new Error("Diff refresh/polling snapped manual scrolling to selection")
       key("end")
       await until(() => text(find("oec-changes-pane")).includes("scroll-diff-059.txt"), "Diff End did not reveal last row")
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: true, version: context.app.version }))
    } catch (error) {
      writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ ok: false, stage, error: String(error), text: text(context.renderer.root).slice(-12000) }))
    } finally { context.renderer.destroy() }
  }, 1500)
  return () => { disposed = true; clearTimeout(start); removeContext() }
} }
`)
  const child = Bun.spawn([executable, "--standalone", project], {
    cwd: project, stdin: "pipe", stdout: "pipe", stderr: "pipe", signal: timeout.signal,
    env: {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
      TERM: "xterm-256color", TEMP: sandbox, TMP: sandbox, LOCALAPPDATA: sandbox, APPDATA: sandbox,
      HOME: sandbox, USERPROFILE: sandbox, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(sandbox, "gitconfig"),
      XDG_CONFIG_HOME: join(sandbox, "config"), XDG_DATA_HOME: join(sandbox, "data"), XDG_CACHE_HOME: join(sandbox, "cache"), XDG_STATE_HOME: join(sandbox, "state"),
        OPENCODE_CLI_CONFIG_CONTENT: JSON.stringify({ terminal: { copy: "manual" }, plugins: [{ package: pluginSource, options: { toggleBinding: "f6", filesBinding: "f7", diffBinding: "f8" } }, observer] }),
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
  console.log(`OpenCode ${result.version}: expanded/compact panel sizing, resize, consent, chat focus, search, local diff tabs, F4, F2 rename, Markdown, image decoding, palette and live Git passed (isolated ${source ?? "checkout"} smoke).`)
} finally { clearTimeout(timer); await rm(sandbox, { recursive: true, force: true }) }
