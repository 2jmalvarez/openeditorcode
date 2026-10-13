/** @jsxImportSource @opentui/solid */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { mockHost } from "./host"
import { SessionFiles } from "../src/explorer/SessionFiles"
import type { TextareaRenderable } from "@opentui/core"

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
