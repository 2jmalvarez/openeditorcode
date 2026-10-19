/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import type { InputRenderable } from "@opentui/core"
import { FilesToggle } from "../src/explorer/FilesToggle"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { EditorProjects } from "../src/integration/projects"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"

test("the initial mouse press/release does not dismiss the local access confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-consent-click-"))
  const host = mockHost(root)
  const [confirming, setConfirming] = createSignal(false)
  let answer!: (value: boolean) => void
  let confirmations = 0
  const context = { ...host.context, options: {}, ui: { ...host.context.ui, dialog: { ...host.context.ui.dialog,
    confirm: async () => { confirmations++; setConfirming(true); return new Promise<boolean>((resolve) => { answer = resolve }) },
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
    expect(host.archives.size).toBe(0)
    answer(true)
    await Bun.sleep(30)
    expect(projects.forSession("session-1")?.filesVisible).toBe(true)
  } finally { setup.renderer.destroy(); await projects.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("sidebar input searches closed folders, opens results, and changed files dispatch the native viewer", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-sidebar-search-"))
  await mkdir(join(root, "nested"))
  await writeFile(join(root, "nested", "hello.ts"), "hello")
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
    await Bun.sleep(30); await setup.renderOnce()
    let frame = setup.captureCharFrame().split("\n")
    const changed = frame.findIndex((line) => line.includes("M nested/hello.ts"))
    expect(changed).toBeGreaterThan(0)
    await setup.mockMouse.click(7, changed)
    expect(host.dispatches).toEqual(["diff.open"])
    expect(host.destinations).toHaveLength(0)
    const input = setup.renderer.root.findDescendantById("oec-files-search") as InputRenderable
    input.focus()
    await setup.mockInput.typeText("HELLO")
    await Bun.sleep(30); await setup.renderOnce()
    expect(controller.fileSearch.items.map((item) => item.path)).toEqual([join(root, "nested", "hello.ts")])
    expect(controller.filesFocused).toBe(false)
    frame = setup.captureCharFrame().split("\n")
    expect(frame.some((line) => line.includes("▾ nested"))).toBe(true)
    expect(frame.some((line) => line.includes("nested/hello.ts") && !line.includes("M nested"))).toBe(false)
    const result = frame.findIndex((line) => line.includes("hello.ts") && !line.includes("M nested"))
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
