/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender, useRenderer } from "@opentui/solid"
import { Workspace, isDirty } from "../src/documents/workspace"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { FileSearch } from "../src/explorer/file-search"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { mockHost } from "./host"
import { editorCommands } from "../src/workbench/useKeyboardShortcuts"
import type { ImageRenderable, InputRenderable, KeyEvent, MarkdownRenderable } from "@opentui/core"
import { configurationText, SHORTCUTS } from "../src/integration/reference"

test("literal search is opt-in, basename-based unless a path is supplied, and preserves fuzzy mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-search-modes-"))
  await mkdir(join(root, "package-folder"))
  await writeFile(join(root, "package.json"), "{}")
  await writeFile(join(root, "package-folder", "unrelated.ts"), "")
  const search = new FileSearch(root)
  try {
    await search.search("package")
    expect(search.items).toHaveLength(2)
    search.setMode("literal")
    expect(search.items.map((file) => file.name)).toEqual(["package.json"])
    await search.search("PACKAGE-FOLDER/unrelated")
    expect(search.items).toHaveLength(1)
    search.setMode("fuzzy")
    await search.search("pckgjs")
    expect(search.items.map((file) => file.name)).toEqual(["package.json"])
  } finally { search.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("diff tabs are independent, bounded and never editable, dirty, saved or archived", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-readonly-model-"))
  const path = join(root, "same.md")
  await writeFile(path, "# Saved")
  const workspace = new Workspace(root)
  try {
    await workspace.open(path)
    workspace.edit(path, "# Unsaved")
    workspace.openView("diff", path, "patch", "changes")
    const diff = workspace.active!
    workspace.edit(diff.path, "must not edit")
    expect(diff.content).toBe("patch")
    expect(isDirty(diff)).toBe(false)
    expect(await workspace.save()).toBe(false)
    await workspace.checkExternal()
    expect(diff.conflict).toBe(false)
    workspace.openView("diff", path, "new patch", "changes")
    expect(workspace.documents).toHaveLength(2)
    workspace.openView("diff", path, "staged", "staged")
    expect(workspace.documents).toHaveLength(3)
    expect(workspace.snapshot().documents.map((document) => document.content)).toEqual(["# Unsaved"])
    expect(workspace.snapshot().activePath).toBeUndefined()
    expect(await readFile(path, "utf8")).toBe("# Saved")
  } finally { workspace.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("F4 opens the current file without closing the diff and never recreates deleted files", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-f4-diff-"))
  const path = join(root, "file.md")
  await writeFile(path, "# Saved")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await controller.open(path)
    controller.workspace.edit(path, "# Unsaved")
    controller.workspace.openView("diff", path, "patch", "changes")
    const id = controller.workspace.activePath!
    await controller.alternateView()
    expect(controller.workspace.active?.content).toBe("# Unsaved")
    expect(controller.workspace.active?.view).toBe("source")
    expect(controller.workspace.documents.find((file) => file.path === id)?.kind).toBe("diff")
    controller.activate(id)
    await rm(path)
    await expect(controller.alternateView()).rejects.toThrow()
    expect(controller.workspace.activePath).toBe(id)
    await expect(readFile(path)).rejects.toThrow()
  } finally { await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("F2 updates dirty buffers and child/diff paths, rejects collisions and protects the root", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-rename-tabs-"))
  await mkdir(join(root, "folder"))
  const path = join(root, "folder", "file.txt")
  await writeFile(path, "saved")
  await writeFile(join(root, "exists"), "do not replace")
  const workspace = new Workspace(root)
  try {
    await workspace.open(path)
    workspace.edit(path, "unsaved")
    workspace.openView("diff", path, "patch", "changes")
    await workspace.rename(join(root, "folder"), "renamed")
    const next = join(root, "renamed", "file.txt")
    expect(workspace.documents[0]?.path).toBe(next)
    expect(workspace.active?.targetPath).toBe(next)
    workspace.activate(next)
    expect(isDirty(workspace.active!)).toBe(true)
    await workspace.save()
    expect(await readFile(next, "utf8")).toBe("unsaved")
    await expect(workspace.rename(join(root, "renamed"), "exists")).rejects.toThrow()
    await expect(workspace.rename(root, "oops")).rejects.toThrow()
    await expect(workspace.rename(next, "../escape")).rejects.toThrow()
    expect(await readFile(join(root, "exists"), "utf8")).toBe("do not replace")
  } finally { workspace.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("Markdown F4 preview renders unsaved content and images use read-only tabs", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-preview-ui-"))
  const path = join(root, "readme.md")
  await writeFile(path, "# Initial heading\n")
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64")
  await writeFile(join(root, "pixel.png"), png)
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root, imageProtocol: "blocks" }))
  await controller.open(path)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 100, height: 28 })
  try {
    await setup.renderOnce()
    expect(setup.renderer.root.findDescendantById("oec-markdown-preview")).toBeDefined()
    await controller.alternateView(); await setup.renderOnce()
    expect(setup.renderer.root.findDescendantById("oec-editor-buffer")).toBeDefined()
    controller.workspace.edit(path, "# Unsaved heading\n")
    await setup.renderOnce()
    await controller.alternateView(); await Bun.sleep(60); await setup.renderOnce(); await setup.renderOnce()
    for (let i = 0; i < 80 && !setup.captureCharFrame().includes("Unsaved heading"); i++) { await Bun.sleep(30); await setup.renderOnce() }
    expect(setup.captureCharFrame()).toContain("Unsaved heading")
    expect(setup.renderer.root.findDescendantById("oec-editor-buffer")).toBeUndefined()
    expect(isDirty(controller.workspace.active!)).toBe(true)
    await controller.open(join(root, "pixel.png")); await setup.renderOnce()
    expect(controller.workspace.active?.kind).toBe("image")
    expect(controller.workspace.active?.bytes).toEqual(new Uint8Array(png))
    expect(await controller.save()).toBe(false)
    expect(controller.workspace.snapshot().documents).toHaveLength(1)
    expect(setup.captureCharFrame()).toContain("Image")
    const image = setup.renderer.root.findDescendantById("oec-image-preview") as ImageRenderable
    await image.loadPromise
    expect(image.loadError).toBeNull()
    expect(image.image?.width).toBe(1)
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("keyboard router consumes F4/search keys, keeps readonly views uneditable and exposes unique palette IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-view-keys-"))
  const path = join(root, "file.md")
  await writeFile(path, "# Heading")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  try {
    await controller.open(path)
    let focus: "editor" | "search" | "explorer" = "editor"
    const commands = editorCommands({ controller, focused: () => focus, editor: () => undefined, findOpen: () => false,
      openFind: () => {}, closeFind: () => {}, moveFind: () => {}, acceptFind: () => {}, cycleFocus: () => {}, focusEditor: () => { focus = "editor" }, focusExplorer: () => { focus = "explorer" },
    })
    const enabled = (bind: string) => commands.filter((command) => command.bind === bind && (typeof command.enabled === "function" ? command.enabled() : command.enabled !== false))
    expect(enabled("ctrl+a")).toHaveLength(0)
    let prevented = false
    await enabled("f4")[0]!.run(undefined, { preventDefault: () => { prevented = true }, stopPropagation: () => {} } as KeyEvent)
    expect(prevented).toBe(true)
    expect(controller.workspace.active?.view).toBe("source")
    expect(enabled("ctrl+a")).toHaveLength(1)
    focus = "search"
    await controller.fileSearch.search("file.md")
    await enabled("ctrl+e")[0]!.run()
    expect(controller.fileSearch.mode).toBe("literal")
    expect(enabled("return")).toHaveLength(1)
    await enabled("return")[0]!.run()
    expect(controller.workspace.activePath).toBe(path)
    controller.workspace.openView("diff", path, "patch", "changes")
    focus = "editor"
    expect(enabled("ctrl+s")).toHaveLength(0)
    expect(enabled("return")).toHaveLength(0)
    const ids = commands.flatMap((command) => command.id ? [command.id] : [])
    expect(new Set(ids).size).toBe(ids.length)
    expect(commands.filter((command) => command.palette).every((command) => command.group === "OEC: opencode-editor" && !command.title?.startsWith("OEC:"))).toBe(true)
    for (const bind of ["ctrl+f", "ctrl+l", "tab", "home", "end", "shift+left", "ctrl+backspace", "ctrl+delete", "ctrl+k", "ctrl+u", "backspace", "delete"]) expect(commands.some((command) => command.bind === bind && command.palette)).toBe(true)
    expect(configurationText(controller.options)).toContain("searchMode")
    for (const key of ["F4", "F2", "Ctrl+E", "Ctrl+S"]) expect(SHORTCUTS).toContain(key)
  } finally { await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("preview styles are isolated by renderer even when hosts share their theme", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-preview-owners-"))
  const path = join(root, "file.md")
  await writeFile(path, "# Shared theme\n")
  const hosts = [mockHost(root), mockHost(root)]
  Object.defineProperty(hosts[1]!.context, "theme", { value: hosts[0]!.context.theme })
  const controllers = hosts.map((host) => new EditorController(host.context, parseOptions({ localRoot: root })))
  const setups: Awaited<ReturnType<typeof testRender>>[] = []
  try {
    for (const [index, controller] of controllers.entries()) {
      await controller.open(path)
      const setup = await testRender(() => {
        Object.defineProperty(hosts[index]!.context, "renderer", { value: useRenderer(), configurable: true })
        return <EditorRoute controller={controller} />
      }, { width: 90, height: 24 })
      setups.push(setup)
      await setup.renderOnce()
    }
    const previews = setups.map((setup) => setup.renderer.root.findDescendantById("oec-markdown-preview") as MarkdownRenderable)
    expect(previews[0]!.syntaxStyle).not.toBe(previews[1]!.syntaxStyle)
    setups[0]!.renderer.destroy()
    expect(previews[1]!.syntaxStyle.getStyleCount()).toBeGreaterThan(0)
    await setups[1]!.renderOnce()
  } finally {
    for (const setup of setups) setup.renderer.destroy()
    for (const controller of controllers) await controller.dispose()
    // Aborted Git readers/watchers release Windows handles asynchronously.
    // Bun 1.3.14 can return EBUSY immediately despite fs.rm's maxRetries.
    // Bound retries explicitly, only for cleanup; never repeat assertions.
    for (let attempt = 0; ; attempt++) {
      try { await rm(root, { recursive: true, force: true }); break }
      catch (error) {
        if (attempt >= 19 || !["EBUSY", "EPERM", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error
        await Bun.sleep(100)
      }
    }
  }
})

test("cursor-only workspace updates cannot steal file search focus", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-search-focus-"))
  const path = join(root, "file.ts")
  await writeFile(path, "line one\nline two\n")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.open(path)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 90, height: 24 })
  try {
    await setup.renderOnce(); await setup.renderOnce()
    const input = setup.renderer.root.findDescendantById("oec-files-search") as InputRenderable
    await setup.mockMouse.click(input.screenX + 2, input.screenY)
    controller.workspace.remember(path, { row: 1, column: 2, scrollX: 0, scrollY: 0 })
    await setup.renderOnce(); await setup.renderOnce()
    expect(input.focused).toBe(true)
    expect(setup.captureCharFrame()).toContain("search")
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("validates all new plugin options without changing fuzzy defaults", () => {
  const root = process.cwd()
  const defaults = parseOptions({ localRoot: root })
  expect(defaults.searchMode).toBe("fuzzy")
  expect(defaults.markdownPreview).toBe(true)
  for (const [key, value] of [["searchMode", "exact"], ["markdownPreview", "yes"], ["diffView", "sideways"], ["imageProtocol", "url"]]) expect(() => parseOptions({ localRoot: root, [key as string]: value })).toThrow()
})
