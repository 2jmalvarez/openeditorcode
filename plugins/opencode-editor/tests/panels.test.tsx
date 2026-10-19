/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender, useRenderer } from "@opentui/solid"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { EditorController } from "../src/integration/controller"
import { EditorProjects } from "../src/integration/projects"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"
import type { TextareaRenderable } from "@opentui/core"

test("F6 shows only Files; F7 independently toggles Diff in either route without losing documents", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-panel-keys-"))
  await writeFile(join(root, "open.txt"), "saved")
  const host = mockHost(root)
  const projects = new EditorProjects(host.context)
  try {
    await projects.toggle()
    const controller = projects.current()!
    expect(controller.editorFilesVisible).toBe(true)
    expect(controller.filesVisible).toBe(true)
    expect(controller.diffVisible).toBe(false)
    await controller.workspace.open(join(root, "open.txt"))
    controller.workspace.edit(controller.workspace.activePath!, "unsaved")
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(true)
    expect(controller.editorFilesVisible).toBe(true)
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(false)
    await projects.toggleDiff()
    await projects.toggle()
    expect(host.context.ui.router.current().type).toBe("session")
    expect(controller.diffVisible).toBe(false)
    expect(controller.filesVisible).toBe(true)
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(true)
    expect(controller.filesVisible).toBe(true)
    await projects.toggle()
    expect(controller.diffVisible).toBe(false)
    expect(controller.workspace.active?.content).toBe("unsaved")
    expect(controller.workspace.active?.savedContent).toBe("saved")
  } finally { await projects.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("Files and Diff accordions clip their content and collapse independently after a large search", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-panels-clip-"))
  await mkdir(join(root, "nested"))
  await Promise.all(Array.from({ length: 90 }, (_, index) => writeFile(join(root, "nested", `tree-file-${String(index).padStart(2, "0")}.ts`), "file")))
  const host = mockHost(root)
  host.vcs.provider = "git"
  host.vcs.files = Array.from({ length: 20 }, (_, index) => ({ file: `git-change-${index}.ts`, status: "modified", additions: 1, deletions: 1 }))
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.toggleFiles()
  controller.toggleDiff()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 34, height: 32 })
  const get = (id: string) => setup.renderer.root.findDescendantById(id)
  try {
    await controller.fileSearch.search("tree-file")
    await controller.changes.refresh()
    controller.fileSearch.move(1000)
    const selectedResult = controller.fileSearch.rows[controller.fileSearch.selected]?.path
    await setup.renderOnce(); await setup.renderOnce()
    const lines = setup.captureCharFrame().split("\n")
    const diffRow = lines.findIndex((line) => line.includes("▾ Diff"))
    expect(diffRow).toBeGreaterThan(0)
    expect(lines.slice(0, diffRow).some((line) => line.includes("tree-file"))).toBe(true)
    expect(lines.slice(diffRow).some((line) => line.includes("tree-file"))).toBe(false)
    expect(lines.slice(0, diffRow).some((line) => line.includes("git-change"))).toBe(false)
    expect(lines.slice(diffRow).some((line) => line.includes("git-change"))).toBe(true)
    expect(get("oec-files-pane")!.screenY + get("oec-files-pane")!.height).toBeLessThanOrEqual(get("oec-diff-toggle")!.screenY)
    await setup.mockMouse.click(4, get("oec-files-toggle")!.screenY)
    await Bun.sleep(0); await setup.renderOnce()
    expect(get("oec-files-pane")).toBeUndefined()
    expect(get("oec-changes-pane")).toBeDefined()
    await setup.mockMouse.click(4, get("oec-diff-toggle")!.screenY)
    await setup.renderOnce()
    expect(get("oec-changes-pane")).toBeUndefined()
    expect(get("oec-files-pane")).toBeUndefined()
    expect(setup.captureCharFrame()).toContain("▸ Files")
    expect(setup.captureCharFrame()).toContain("▸ Diff")
    const calls = host.vcs.calls.length
    await controller.changes.refresh()
    expect(host.vcs.calls.length).toBe(calls)
    await setup.mockMouse.click(4, get("oec-files-toggle")!.screenY)
    await controller.tree.refresh(); await controller.fileSearch.refresh(); await setup.renderOnce()
    expect(get("oec-files-pane")).toBeDefined()
    expect(get("oec-changes-pane")).toBeUndefined()
    expect(controller.fileSearch.query).toBe("tree-file")
    expect(controller.fileSearch.rows[controller.fileSearch.selected]?.path).toBe(selectedResult)
    controller.toggleDiff()
    await setup.renderOnce()
    expect(get("oec-diff-toggle")).toBeUndefined()
    expect(get("oec-files-pane")).toBeDefined()
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
  expect(host.layers.size).toBe(0)
  expect([...host.events.values()].every((handlers) => handlers.size === 0)).toBe(true)
})

test.each([10, 18, 32])("editor includes bounded Diff when enabled, including a %i-row terminal", async (height) => {
  const root = await mkdtemp(join(tmpdir(), "oec-editor-panels-"))
  await writeFile(join(root, "visible.txt"), "file")
  const host = mockHost(root)
  host.vcs.provider = "git"
  host.vcs.files = [{ file: "visible.txt", status: "modified", additions: 1, deletions: 1 }]
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }))
  await controller.enter("session-1")
  await controller.workspace.open(join(root, "visible.txt"))
  controller.toggleDiff()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <EditorRoute controller={controller} />
  }, { width: 90, height })
  try {
    await controller.tree.refresh(); await controller.changes.refresh()
    await setup.renderOnce(); await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("▾ Files")
    expect(frame).toContain("▾ Diff")
    const tree = setup.renderer.root.findDescendantById("oec-files-pane")!
    const header = setup.renderer.root.findDescendantById("oec-diff-toggle")!
    const diff = setup.renderer.root.findDescendantById("oec-changes-pane")!
    expect(tree.screenY + tree.height).toBeLessThanOrEqual(header.screenY)
    expect(diff.screenY + diff.height).toBeLessThanOrEqual(height - 1)
    diff.focus()
    await setup.renderOnce()
    controller.toggleDiff()
    await setup.renderOnce()
    expect((setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable).focused).toBe(true)
    controller.toggleDiff()
    await setup.renderOnce()
    await controller.openNativeDiff()
    expect(host.context.ui.router.current().type).toBe("session")
    expect(host.dispatches).toEqual(["diff.open"])
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})
