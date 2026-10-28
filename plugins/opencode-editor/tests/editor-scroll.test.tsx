/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ScrollBarRenderable, type Renderable, type TextareaRenderable } from "@opentui/core"
import { testRender, useRenderer } from "@opentui/solid"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { mockHost } from "./host"

function horizontalBar(node: Renderable): ScrollBarRenderable | undefined {
  if (node instanceof ScrollBarRenderable && node.orientation === "horizontal") return node
  return node.getChildren().map(horizontalBar).find(Boolean)
}

test("plugin editor: Shift+wheel and scrollbar dragging persist in document position", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-editor-scroll-"))
  const path = join(root, "wide.ts")
  await writeFile(path, Array.from({ length: 100 }, () => "const text = 'long line'; ".repeat(30)).join("\n"))
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.enter("session-1")
  await controller.open(path)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 100, height: 36 })
  const frames = async () => { for (let i = 0; i < 6; i++) { await setup.renderOnce(); setup.renderer.emit("frame") } }
  try {
    await frames()
    const editor = setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable
    const bar = horizontalBar(setup.renderer.root)!
    expect(bar.visible).toBe(true)
    const y = editor.scrollY
    await setup.mockMouse.scroll(editor.screenX + 2, editor.screenY + 2, "down", { modifiers: { shift: true } })
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBeGreaterThan(0)
    expect(editor.scrollY).toBe(y)
    await setup.mockMouse.drag(bar.slider.screenX, bar.slider.screenY, bar.slider.screenX + bar.slider.width - 1, bar.slider.screenY)
    await frames()
    const x = editor.editorView.getViewport().offsetX
    expect(x).toBeGreaterThan(100)
    expect(controller.workspace.active!.position.scrollX).toBe(x)
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBe(x)
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})
