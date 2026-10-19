/** @jsxImportSource @opentui/solid */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { mockHost } from "./host"
import { SessionFiles } from "../src/explorer/SessionFiles"
import type { InputRenderable, TextareaRenderable } from "@opentui/core"

let root = ""
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-plugin-ui-"))
  await writeFile(join(root, "hello.ts"), Array.from({ length: 60 }, (_, index) => `const line${index} = ${index};`).join("\n"))
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test("active editor recovers real keyboard focus without stealing it from a modal", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(join(root, "hello.ts"))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 110, height: 18 })
  try {
    await setup.renderOnce()
    const editor = setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable
    const popModal = host.context.keymap.mode.push("modal")
    editor.blur()
    await setup.renderOnce()
    expect(editor.focused).toBe(false)
    popModal()
    await setup.renderOnce()
    expect(editor.focused).toBe(true)
    expect(setup.renderer.currentFocusedRenderable).toBe(editor)
    await setup.mockInput.typeText("typed")
    expect(editor.plainText.slice(0, 5)).toBe("typed")
    await setup.mockInput.pressEnter()
    await setup.mockInput.typeText("second")
    await setup.renderOnce()
    expect(controller.workspace.active?.content.slice(0, 12)).toBe("typed\nsecond")
  } finally { setup.renderer.destroy(); await controller.dispose() }
})

test("editor route retains document cursor, scroll, and edits across unmount and remount", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(join(root, "hello.ts"))
  controller.workspace.remember(controller.workspace.activePath!, { row: 24, column: 2, scrollX: 0, scrollY: 20 })
  const [visible, setVisible] = createSignal(true)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <Show when={visible()}><EditorRoute controller={controller} /></Show>
  }, { width: 110, height: 18 })
  try {
    for (let i = 0; i < 4; i++) { await setup.renderOnce(); await Bun.sleep(25) }
    expect(setup.captureCharFrame()).toContain("hello.ts")
    expect(setup.captureCharFrame()).toContain("FILES")
    expect(host.mode()).toBe("oec-editor")
    const position = { ...controller.workspace.active!.position }
    expect(position.row).toBe(24)
    expect(position.scrollY).toBe(20)
    setVisible(false)
    await setup.renderOnce()
    expect(host.mode()).toBe("base")
    expect(host.layers.size).toBe(0)
    expect(controller.workspace.active?.position).toEqual(position)
    controller.workspace.edit(controller.workspace.activePath!, "unsaved\n" + controller.workspace.active!.content)
    setVisible(true)
    for (let i = 0; i < 4; i++) { await setup.renderOnce(); await Bun.sleep(25) }
    expect(controller.workspace.active?.content.startsWith("unsaved")).toBe(true)
    expect(controller.workspace.active?.position.row).toBe(position.row)
  } finally { setVisible(false); await setup.renderOnce(); setup.renderer.destroy(); await controller.dispose() }
})

test("mouse opens a sidebar file in the editor without duplicating tabs", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 40, height: 20 })
  try {
    for (let i = 0; i < 3; i++) { await setup.renderOnce(); await Bun.sleep(25) }
    const frame = setup.captureCharFrame().split("\n")
    const row = frame.findIndex((line) => line.includes("hello.ts"))
    expect(row).toBeGreaterThanOrEqual(0)
    await setup.mockMouse.click(6, row)
    for (let i = 0; i < 3; i++) { await setup.renderOnce(); await Bun.sleep(25) }
    expect(controller.workspace.activePath).toBe(join(root, "hello.ts"))
    expect(host.destinations.at(-1)?.type).toBe("plugin")
    await setup.mockMouse.click(6, row)
    for (let i = 0; i < 3; i++) { await setup.renderOnce(); await Bun.sleep(25) }
    expect(controller.workspace.documents).toHaveLength(1)
  } finally { setup.renderer.destroy(); await controller.dispose() }
})

test("Ctrl+A selects the entire file, only in editor focus and outside find/modal", async () => {
  const content = "primera línea café\n\núltima línea\n"
  await writeFile(join(root, "hello.ts"), content)
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(join(root, "hello.ts"))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 110, height: 18 })
  try {
    await setup.renderOnce()
    const editor = setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable
    const layer = () => [...host.layers].map((factory) => factory()).find((entry) => entry.mode === "oec-editor")!
    const command = (id: string) => layer().commands!.find((entry) => entry.id === id)!
    const enabled = () => { const value = command("oec.select.all").enabled; return typeof value === "function" ? value() : value }
    const select = command("oec.select.all")
    expect(select.bind).toBe("ctrl+a")
    expect(select.palette).toBe(true)
    expect(enabled()).toBe(true)
    editor.setCursor(1, 0)
    await select.run?.()
    expect(editor.getSelectedText()).toBe(content)
    expect(controller.workspace.active?.content).toBe(content)
    await command("oec.focus").run?.()
    expect(enabled()).toBe(false)
    await command("oec.focus").run?.()
    await command("oec.find").run?.()
    expect(enabled()).toBe(false)
    let finish!: () => void
    const pending = controller.dialog(() => new Promise<void>((resolve) => { finish = resolve }))
    expect(layer().enabled).toBe(false)
    finish(); await pending
    expect(layer().enabled).toBe(true)
  } finally { setup.renderer.destroy(); await controller.dispose() }
  expect(host.layers.size).toBe(0)
})

test("sidebar never reclaims focus from the chat, including after modal and state updates", async () => {
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <box flexDirection="column"><SessionFiles controller={controller} sessionID="session-1" /><textarea id="host-chat" height={3} /></box>
  }, { width: 70, height: 30 })
  try {
    await setup.renderOnce()
    const target = setup.renderer.root.findDescendantById("oec-files-pane")
    const chat = setup.renderer.root.findDescendantById("host-chat") as TextareaRenderable
    expect(target).toBeDefined()
    const pop = host.context.keymap.mode.push("modal")
    chat.focus()
    await setup.renderOnce()
    expect(target!.focused).toBe(false)
    pop()
    controller.setStatus("A background update must not focus Files")
    await setup.renderOnce()
    expect(target!.focused).toBe(false)
    expect(setup.renderer.currentFocusedRenderable).toBe(chat)
    await setup.mockInput.typeText("chat with Files open")
    await setup.renderOnce()
    expect(chat.plainText).toBe("chat with Files open")
    expect(controller.filesVisible).toBe(true)
    expect(controller.filesFocused).toBe(false)
  } finally { setup.renderer.destroy(); await controller.dispose() }
})

test("F6 has a searchable hierarchical tree, input priority, and restores the normal tree", async () => {
  await mkdir(join(root, "nested", "deeper"), { recursive: true })
  await writeFile(join(root, "nested", "deeper", "needle.ts"), "needle")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(join(root, "hello.ts"))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 110, height: 20 })
  try {
    await controller.tree.refresh(); await setup.renderOnce()
    controller.tree.select(controller.tree.items.findIndex((row) => row.name === "nested"))
    const normalSelection = controller.tree.selected
    const normalRows = controller.tree.items.map((row) => row.path)
    const input = setup.renderer.root.findDescendantById("oec-files-search") as InputRenderable
    expect(input).toBeDefined()
    input.focus()
    await setup.mockInput.typeText("needle")
    await Bun.sleep(30); await setup.renderOnce()
    expect(setup.renderer.currentFocusedRenderable).toBe(input)
    expect(controller.fileSearch.rows.map((row) => [row.name, row.depth])).toEqual([["nested", 0], ["deeper", 1], ["needle.ts", 2]])
    const frame = setup.captureCharFrame()
    expect(frame).toContain("▾ nested")
    expect(frame).toContain("▾ deeper")
    expect(frame).toContain("needle.ts")
    expect(frame).not.toContain("nested/deeper/needle.ts")
    const layers = () => [...host.layers].map((factory) => factory())
    const global = () => layers().find((entry) => entry.commands?.some((command) => command.id === "oec.wrap"))!
    const search = () => layers().find((entry) => entry.priority === 55)!
    const tree = () => layers().find((entry) => entry.priority === 45)!
    expect(search().enabled).toBe(true)
    expect(search().priority).toBeGreaterThan(global().priority!)
    const wrap = global().commands!.find((entry) => entry.id === "oec.wrap")!
    expect(typeof wrap.enabled === "function" && wrap.enabled()).toBe(false)
    await search().commands!.find((entry) => entry.bind === "tab")!.run()
    await setup.renderOnce()
    expect(tree().enabled).toBe(true)
    expect(controller.fileSearch.query).toBe("needle")
    await tree().commands!.find((entry) => entry.bind === "escape")!.run()
    await setup.renderOnce()
    expect(controller.fileSearch.query).toBe("")
    expect(controller.tree.selected).toBe(normalSelection)
    expect(controller.tree.items.map((row) => row.path)).toEqual(normalRows)
    expect(frame).not.toContain("No matching files")
  } finally { setup.renderer.destroy(); await controller.dispose() }
  expect(host.layers.size).toBe(0)
  expect([...host.events.values()].every((handlers) => handlers.size === 0)).toBe(true)
})

test("Ctrl+L wraps visually without edits and retains wrap/cursor across route remount", async () => {
  const text = "long line " + "word ".repeat(1000) + "\nsecond line"
  await writeFile(join(root, "hello.ts"), text)
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(join(root, "hello.ts"))
  const [visible, setVisible] = createSignal(true)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <Show when={visible()}><EditorRoute controller={controller} /></Show>
  }, { width: 85, height: 18 })
  try {
    await setup.renderOnce()
    const editor = () => setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable
    const wrap = () => [...host.layers].map((factory) => factory()).flatMap((layer) => layer.commands ?? []).find((command) => command.id === "oec.wrap")!
    editor().setCursor(0, 3500)
    const cursor = { ...editor().logicalCursor }
    expect(editor().wrapMode).toBe("none")
    expect(wrap().bind).toBe("ctrl+l")
    await wrap().run()
    await setup.renderOnce()
    expect(editor().wrapMode).toBe("word")
    expect(editor().virtualLineCount).toBeGreaterThan(2)
    expect(editor().logicalCursor).toEqual(cursor)
    expect(editor().plainText).toBe(text)
    expect(controller.workspace.active?.savedContent).toBe(text)
    const wrappedScroll = editor().editorView.getViewport().offsetY
    expect(wrappedScroll).toBeGreaterThan(0)
    setVisible(false); await setup.renderOnce()
    setVisible(true); await setup.renderOnce(); await setup.renderOnce()
    expect(editor().wrapMode).toBe("word")
    expect(editor().logicalCursor).toEqual(cursor)
    expect(editor().editorView.getViewport().offsetY).toBe(wrappedScroll)
    await wrap().run(); await setup.renderOnce()
    expect(editor().wrapMode).toBe("none")
    expect(editor().plainText).toBe(text)
    expect(editor().logicalCursor).toEqual(cursor)
  } finally { setup.renderer.destroy(); await controller.dispose() }
})
