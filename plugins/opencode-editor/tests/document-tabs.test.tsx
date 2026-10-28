/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testRender } from "@opentui/solid"
import { DocumentTabs } from "../src/documents/DocumentTabs"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"

test("middle-click closes an inactive tab without activation and respects dirty confirmation and modal guards", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-tab-mouse-"))
  const first = join(root, "first.txt")
  const second = join(root, "second.txt")
  await writeFile(first, "saved first"); await writeFile(second, "saved second")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.workspace.open(first); await controller.workspace.open(second)
  controller.workspace.activate(first)
  let focused = 0
  const setup = await testRender(() => <DocumentTabs controller={controller} onFocus={() => focused++} />, { width: 80, height: 5 })
  const tab = () => setup.renderer.root.findDescendantById(`oec-document-tab:${second}`)!
  const pointer = spyOn(setup.renderer, "setMousePointer")
  try {
    await setup.renderOnce()
    await setup.mockMouse.moveTo(tab().screenX + 3, tab().screenY)
    expect(pointer).toHaveBeenLastCalledWith("pointer")
    await setup.mockMouse.moveTo(79, 4)
    expect(pointer).toHaveBeenLastCalledWith("default")
    await setup.mockMouse.click(tab().screenX + 3, tab().screenY, 2)
    expect(controller.workspace.activePath).toBe(first)
    expect(controller.workspace.documents).toHaveLength(2)
    controller.workspace.edit(second, "unsaved second")
    await setup.renderOnce()
    for (const offset of [0, 3, tab().width - 2, tab().width - 1]) {
      host.selections.push("cancel")
      await setup.mockMouse.click(tab().screenX + offset, tab().screenY, 1)
      await setup.renderOnce()
      expect(host.selections).toHaveLength(0)
      expect(controller.workspace.activePath).toBe(first)
      expect(controller.workspace.documents).toHaveLength(2)
    }
    let release!: () => void
    const modal = controller.dialog(() => new Promise<void>((resolve) => { release = resolve }))
    await setup.mockMouse.click(tab().screenX + 3, tab().screenY, 1)
    expect(controller.workspace.documents).toHaveLength(2)
    release(); await modal
    host.selections.push("discard")
    await setup.mockMouse.click(tab().screenX + 3, tab().screenY, 1)
    await setup.renderOnce()
    expect(controller.workspace.documents.map((document) => document.path)).toEqual([first])
    expect(controller.workspace.activePath).toBe(first)
    expect(focused).toBe(0)
    expect(await readFile(second, "utf8")).toBe("saved second")
    await controller.workspace.open(second); controller.workspace.activate(first)
    await setup.renderOnce()
    await setup.mockMouse.click(tab().screenX, tab().screenY, 1)
    await setup.renderOnce()
    expect(controller.workspace.documents.map((document) => document.path)).toEqual([first])
  } finally { pointer.mockRestore(); setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})
