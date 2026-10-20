/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import type { InputRenderable, ScrollBoxRenderable } from "@opentui/core"
import { FilesToggle } from "../src/explorer/FilesToggle"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { EditorProjects } from "../src/integration/projects"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"
import { sidebarLayout } from "../src/explorer/sidebar-layout"

test("sidebar reserves six MCP rows and only exceeds its budget at minimum panel sizes", () => {
  for (const rows of [32, 36, 40, 50, 70]) {
    const layout = sidebarLayout(rows, true, true, true)
    expect(layout.files).toBeLessThanOrEqual(10)
    expect(layout.files).toBeGreaterThanOrEqual(3)
    expect(layout.changes).toBeLessThanOrEqual(8)
    expect(20 + 3 + layout.files + layout.changes).toBeLessThanOrEqual(rows)
  }
  expect(sidebarLayout(40, true, true, true)).toEqual({ files: 9, changes: 8 })
  expect(sidebarLayout(24, true, true, true)).toEqual({ files: 3, changes: 3 })
  expect(sidebarLayout(32, true, false, false).files).toBe(10)
  expect(sidebarLayout(32, true, true, false).files).toBe(9)
})

test("six MCP servers fit above Files and Diff; resize retains inner scrolling and outer overflow remains available", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-sidebar-budget-"))
  await Promise.all(Array.from({ length: 40 }, (_, i) => writeFile(join(root, `file-${i}.ts`), "file")))
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const [extra, setExtra] = createSignal(0)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <box flexDirection="column" height="100%">
      <scrollbox id="host-sidebar" flexGrow={1} flexBasis={0} minHeight={0} scrollY>
        <box height={18 + extra()} flexShrink={0}><text>Title, context and six MCP servers</text></box>
        <SessionFiles controller={controller} sessionID="session-1" />
      </scrollbox>
      <box height={2} flexShrink={0}><text>Host footer</text></box>
    </box>
  }, { width: 50, height: 40 })
  const outer = () => setup.renderer.root.findDescendantById("host-sidebar") as ScrollBoxRenderable
  const tree = () => setup.renderer.root.findDescendantById("oec-files-scroll") as ScrollBoxRenderable
  try {
    await setup.renderOnce(); await setup.renderOnce()
    expect(outer().scrollHeight).toBeLessThanOrEqual(outer().viewport.height)
    expect(tree().scrollHeight).toBeGreaterThan(tree().viewport.height)
    expect(setup.renderer.root.findDescendantById("oec-files-pane")!.height).toBe(8)
    setup.resize(50, 32)
    await setup.renderOnce(); await setup.renderOnce()
    expect(outer().scrollHeight).toBeLessThanOrEqual(outer().viewport.height)
    expect(setup.renderer.root.findDescendantById("oec-files-pane")!.height).toBe(2)
    setExtra(10)
    await setup.renderOnce(); await setup.renderOnce()
    expect(outer().scrollHeight).toBeGreaterThan(outer().viewport.height)
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("the initial mouse press/release does not dismiss the local access confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-consent-click-"))
  const host = mockHost(root)
  const [confirming, setConfirming] = createSignal(false)
  let answer!: (value: string) => void
  let confirmations = 0
  const context = { ...host.context, options: {}, ui: { ...host.context.ui, dialog: { ...host.context.ui.dialog,
    select: async () => { confirmations++; setConfirming(true); return new Promise<never>((resolve) => { answer = (value) => resolve(value as never) }) },
  } } }
  const projects = new EditorProjects(context)
  const setup = await testRender(() => <box flexDirection="column"
    onMouseDown={() => setConfirming(false)} onMouseUp={() => setConfirming(false)}>
    <FilesToggle context={context} label="OEC · Show files" toggle={() => void projects.toggleFiles()} />
    <Show when={confirming()}><text>Allow local access?</text></Show>
  </box>, { width: 50, height: 10 })
  try {
    await setup.renderOnce()
    await setup.mockMouse.pressDown(5, 0)
    await setup.renderOnce()
    expect(confirmations).toBe(0)
    await setup.mockMouse.release(5, 0)
    await setup.renderOnce()
    expect(confirmations).toBe(1)
    expect(confirming()).toBe(true)
    expect(setup.captureCharFrame()).toContain("Allow local access?")
    expect(projects.forSession("session-1")).toBeUndefined()
    expect([...host.archives.keys()].every((key) => key.startsWith("local-access.v1."))).toBe(true)
    answer("once")
    await Bun.sleep(30)
    expect(projects.forSession("session-1")?.filesVisible).toBe(true)
  } finally { setup.renderer.destroy(); await projects.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("sidebar search opens closed-folder results and local changes open a diff tab, not the native viewer", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-sidebar-search-"))
  await mkdir(join(root, "nested"))
  await writeFile(join(root, "nested", "hello.ts"), "hello")
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", "-C", root, ...args], { stdout: "ignore", stderr: "pipe" })
    if (await child.exited) throw new Error(await new Response(child.stderr).text())
  }
  await git("init", "-q")
  await git("add", ".")
  await git("-c", "user.name=OEC Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial")
  await writeFile(join(root, "nested", "hello.ts"), "changed")
  const host = mockHost(root)
  host.vcs.provider = "git"
  host.vcs.files = [{ file: "nested/hello.ts", status: "modified", additions: 2, deletions: 1 }]
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 70, height: 30 })
  try {
    await controller.changes.refresh(); await setup.renderOnce()
    let frame = setup.captureCharFrame().split("\n")
    const changed = frame.findIndex((line) => line.includes("M hello.ts"))
    expect(changed).toBeGreaterThan(0)
    await setup.mockMouse.click(7, changed)
    for (let i = 0; i < 60 && host.destinations.at(-1)?.type !== "plugin"; i++) await Bun.sleep(20)
    expect(host.dispatches).toEqual([])
    expect(controller.workspace.active?.kind).toBe("diff")
    expect(controller.workspace.active?.content).toContain("-hello")
    expect(host.destinations.at(-1)?.type).toBe("plugin")
    const input = setup.renderer.root.findDescendantById("oec-files-search") as InputRenderable
    input.focus()
    await setup.mockInput.typeText("HELLO")
    await Bun.sleep(30); await setup.renderOnce()
    expect(controller.fileSearch.items.map((item) => item.path)).toEqual([join(root, "nested", "hello.ts")])
    expect(controller.filesFocused).toBe(false)
    frame = setup.captureCharFrame().split("\n")
    expect(frame.some((line) => line.includes("▾ nested"))).toBe(true)
    expect(frame.some((line) => line.includes("nested/hello.ts"))).toBe(false)
    const result = frame.findIndex((line) => line.includes("hello.ts") && !line.includes("M hello"))
    expect(result).toBeGreaterThan(0)
    await setup.mockInput.pressEnter()
    await Bun.sleep(30)
    expect(controller.workspace.activePath).toBe(join(root, "nested", "hello.ts"))
    expect(host.destinations.at(-1)?.type).toBe("plugin")
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
  expect([...host.events.values()].every((handlers) => handlers.size === 0)).toBe(true)
  expect(host.layers.size).toBe(0)
})

test("selected long names scroll once to the end and reset when selection changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-sidebar-long-name-"))
  await writeFile(join(root, "abcdefghijklmnop-tail.ts"), "long")
  await writeFile(join(root, "zshort.ts"), "short")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 20, height: 25 })
  try {
    await setup.renderOnce(); await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("abcdef")
    await Bun.sleep(2600); await setup.renderOnce()
    const end = setup.captureCharFrame()
    expect(end).toContain("tail.ts")
    expect(end).not.toContain("abcdef")
    await Bun.sleep(350); await setup.renderOnce()
    expect(setup.captureCharFrame()).toBe(end)
    controller.tree.select(1); await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("abcdef")
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
}, 8000)
