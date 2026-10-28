/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { ScrollBarRenderable, type Renderable, type TextareaRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { EditorScrollFrame } from "../src/editor/EditorScrollFrame"

function bars(node: Renderable): ScrollBarRenderable[] {
  return node instanceof ScrollBarRenderable ? [node] : node.getChildren().flatMap(bars)
}

for (const gutter of [5, 6]) test(`editor scroll frame (${gutter} column gutter): drag both axes and Shift+wheel`, async () => {
  let editor!: TextareaRenderable
  const text = Array.from({ length: 100 }, (_, row) => `${row}: ${"界\ttext ".repeat(40)}`).join("\n")
  const setup = await testRender(() => {
    const [value, setValue] = createSignal<TextareaRenderable>()
    return <box width="100%" height="100%"><EditorScrollFrame editor={value} gutter={gutter} foreground="#888888" background="#111111">
      <box width={gutter} flexShrink={0} />
      <textarea ref={(node) => { editor = node; setValue(node) }} initialValue={text} focused wrapMode="none" flexGrow={1} minWidth={0} />
    </EditorScrollFrame></box>
  }, { width: 70, height: 16 })
  const frames = async () => { for (let i = 0; i < 6; i++) { await setup.renderOnce(); setup.renderer.emit("frame") } }
  try {
    await frames()
    const horizontal = bars(setup.renderer.root).find((bar) => bar.orientation === "horizontal")!
    const vertical = bars(setup.renderer.root).find((bar) => bar.orientation === "vertical")!
    expect(horizontal.visible).toBe(true)
    expect(horizontal.scrollSize).toBeGreaterThan(editor.width)
    await setup.mockMouse.drag(horizontal.slider.screenX, horizontal.slider.screenY, horizontal.slider.screenX + horizontal.slider.width - 1, horizontal.slider.screenY)
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBeGreaterThan(0)
    const afterDrag = editor.editorView.getViewport().offsetX
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBe(afterDrag)
    await setup.mockMouse.drag(vertical.slider.screenX, vertical.slider.screenY, vertical.slider.screenX, vertical.slider.screenY + vertical.slider.height - 1)
    await frames()
    expect(editor.scrollY).toBeGreaterThan(30)
    horizontal.scrollPosition = 0
    vertical.scrollPosition = 0
    await frames()
    const before = editor.editorView.getViewport()
    await setup.mockMouse.scroll(editor.screenX + 2, editor.screenY + 2, "down", { modifiers: { shift: true } })
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBeGreaterThan(before.offsetX)
    expect(editor.scrollY).toBe(before.offsetY)
    await setup.mockMouse.scroll(editor.screenX + 2, editor.screenY + 2, "up", { modifiers: { shift: true } })
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBe(before.offsetX)
    await setup.mockMouse.scroll(editor.screenX + 2, editor.screenY + 2, "down")
    await frames()
    expect(editor.scrollY).toBeGreaterThan(before.offsetY)
    setup.renderer.resize(90, 20)
    await frames()
    expect(horizontal.viewportSize).toBe(editor.width)
    expect(vertical.viewportSize).toBe(editor.height)
    expect(horizontal.slider.screenY).toBeLessThan(20)
    editor.wrapMode = "word"
    await frames()
    expect(horizontal.visible).toBe(false)
    expect(editor.editorView.getViewport().offsetX).toBe(0)
    editor.wrapMode = "none"
    editor.setText("short")
    await frames()
    expect(horizontal.visible).toBe(false)
    expect(editor.scrollY).toBe(0)
    editor.setText(`short\n${"long ".repeat(100)}\nend`)
    await frames()
    horizontal.scrollPosition = 80
    await frames()
    expect(editor.editorView.getViewport().offsetX).toBeGreaterThan(0)
  } finally { setup.renderer.destroy() }
})
