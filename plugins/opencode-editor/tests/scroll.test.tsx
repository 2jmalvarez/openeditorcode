/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ScrollBoxRenderable, type Renderable } from "@opentui/core"
import { testRender, useRenderer } from "@opentui/solid"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { mockHost } from "./host"

function scrollbox(node: Renderable): ScrollBoxRenderable | undefined {
  if (node instanceof ScrollBoxRenderable) return node
  return node.getChildren().map(scrollbox).find(Boolean)
}

for (const editor of [false, true]) for (const panel of ["files", "changes"]) {
  test(`${editor ? "editor" : "conversation"} ${panel}: manual scrolling survives virtualization and refresh`, async () => {
    const root = await mkdtemp(join(tmpdir(), "oec-tree-scroll-"))
    await Promise.all(Array.from({ length: 120 }, (_, index) => writeFile(join(root, `file-${String(index).padStart(3, "0")}.ts`), "text")))
    const host = mockHost(root)
    const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true,
      files: Array.from({ length: 120 }, (_, index) => ({ file: `nested/change-${String(index).padStart(3, "0")}.ts`, path: `nested/change-${String(index).padStart(3, "0")}.ts`, area: "changes", status: "modified", additions: 1, deletions: 1 })),
    }))
    await controller.toggleFiles()
    if (editor) await controller.enter("session-1")
    const setup = await testRender(() => {
      Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
      return editor ? <EditorRoute controller={controller} /> : <SessionFiles controller={controller} sessionID="session-1" />
    }, { width: 100, height: 36 })
    const frames = async (count = 5) => { for (let i = 0; i < count; i++) { await setup.renderOnce(); setup.renderer.emit("frame") } }
    try {
      await controller.tree.refresh(); await controller.changes.refresh(); await frames()
      const node = setup.renderer.root.findDescendantById(panel === "files" ? "oec-files-pane" : "oec-changes-pane")!
      const view = scrollbox(node)!
      expect(view.scrollHeight).toBeGreaterThan(100)
      // Same scrollTop setter used by native scrollbar dragging.
      view.scrollTop = 45
      await frames()
      expect(view.scrollTop).toBe(45)
      await controller.tree.refresh(); await controller.changes.refresh(); await frames()
      expect(view.scrollTop).toBe(45)
      for (let i = 0; i < 5; i++) { await setup.mockMouse.scroll(view.viewport.screenX + 2, view.viewport.screenY + 2, "down"); await frames(2) }
      expect(view.scrollTop).toBeGreaterThan(45)
      const afterWheel = view.scrollTop
      await frames()
      expect(view.scrollTop).toBe(afterWheel)
      await setup.mockMouse.scroll(view.viewport.screenX + 2, view.viewport.screenY + 2, "up"); await frames()
      expect(view.scrollTop).toBeLessThan(afterWheel)
      view.scrollTop = 0; await frames()
      const slider = view.verticalScrollBar.slider
      await setup.mockMouse.drag(slider.screenX, slider.screenY, slider.screenX, slider.screenY + slider.height - 1)
      await frames()
      const afterDrag = view.scrollTop
      expect(afterDrag).toBeGreaterThan(30)
      await controller.tree.refresh(); await controller.changes.refresh(); await frames()
      expect(view.scrollTop).toBe(afterDrag)

      node.focus(); await frames()
      const press = async (bind: string) => {
        const layer = [...host.layers].map((factory) => factory()).find((layer) => layer.target?.()?.id === node.id && layer.enabled !== false)
        const command = layer?.commands?.find((command) => command.bind === bind)
        expect(command).toBeDefined()
        await command!.run(); await frames()
      }
      await press("end")
      expect(view.scrollTop + view.viewport.height).toBeGreaterThanOrEqual(panel === "files" ? 120 : 121)
      // Keyboard navigation reveals the selection even when clamped at the end.
      view.scrollTop = 0; await frames()
      await press("down")
      expect(view.scrollTop).toBeGreaterThan(90)
      await press("home")
      expect(view.scrollTop).toBe(0)
      await press("pagedown")
      expect(view.scrollTop).toBeGreaterThan(0)
      await press("pageup")
      expect(view.scrollTop).toBe(0)
      expect(controller.workspace.documents).toHaveLength(0)
      expect(host.context.ui.router.current().type).toBe(editor ? "plugin" : "session")
    } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
  })
}

test("file-search scrolling survives refresh and a query change restores its own viewport", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-search-scroll-"))
  await Promise.all(Array.from({ length: 100 }, (_, index) => writeFile(join(root, `match-${String(index).padStart(3, "0")}.ts`), "text")))
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 50, height: 32 })
  const frames = async () => { for (let i = 0; i < 5; i++) { await setup.renderOnce(); setup.renderer.emit("frame") } }
  try {
    await controller.tree.refresh(); await frames()
    const view = scrollbox(setup.renderer.root.findDescendantById("oec-files-pane")!)!
    view.scrollTop = 30; await frames()
    await controller.fileSearch.search("match"); await frames()
    expect(view.scrollTop).toBe(0)
    view.scrollTop = 45; await frames()
    await controller.fileSearch.refresh(); await frames()
    expect(view.scrollTop).toBe(45)
    controller.fileSearch.move(1000); await frames()
    expect(view.scrollTop).toBeGreaterThan(60)
    await controller.fileSearch.search(""); await frames()
    expect(view.scrollTop).toBe(30)
    // Collapsing and reopening Files must not undo a manual viewport.
    await controller.toggleFiles(); await frames()
    await controller.toggleFiles(); await frames()
    const restored = scrollbox(setup.renderer.root.findDescendantById("oec-files-pane")!)!
    expect(restored.scrollTop).toBe(30)
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})
