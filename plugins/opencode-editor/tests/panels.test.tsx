/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender, useRenderer } from "@opentui/solid"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { ChangesPane } from "../src/changes/ChangesPane"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { EditorController } from "../src/integration/controller"
import { EditorProjects } from "../src/integration/projects"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"
import type { TextareaRenderable } from "@opentui/core"

test("Diff renders repo markers and branches, and mouse toggles only the clicked repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-repo-panel-"))
  const host = mockHost(root)
  const repositories = [
    { id: "a", root: join(root, "a"), name: "a", branch: "main" },
    { id: "b", root: join(root, "b"), name: "b", branch: "feature/test" },
  ]
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({
    repository: true, repositories,
    files: [{ path: "a-only.txt", file: "a-only.txt", area: "changes", status: "untracked", repositoryRoot: repositories[0]!.root, additions: 1, deletions: 0 }],
  }))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 42, height: 32 })
  try {
    await controller.changes.refresh(); await setup.renderOnce(); await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("● ▾ a (1)")
    expect(setup.captureCharFrame()).toContain("main")
    expect(setup.captureCharFrame()).toContain("feature/test")
    expect(setup.captureCharFrame()).toContain("No changes")
    const lines = setup.captureCharFrame().split("\n")
    expect(lines.find((line) => line.includes("● ▾ a (1)"))).toMatch(/a \(1\)\s+main/)
    expect(lines.find((line) => line.includes("● ▾ b"))).toMatch(/b\s+feature\/test/)
    expect(setup.captureCharFrame()).not.toContain("(0)")
    expect(setup.renderer.root.findDescendantById("oec-diff-row:repo:a:branch")).toBeUndefined()
    const repo = () => setup.renderer.root.findDescendantById("oec-diff-row:repo:a")!
    await setup.mockMouse.click(repo().screenX + 2, repo().screenY)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("a-only.txt")
    expect(setup.captureCharFrame()).toContain("main")
    expect(setup.captureCharFrame()).toMatch(/● ▸ a \(1\)\s+main/)
    await setup.mockMouse.click(repo().screenX + 2, repo().screenY)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("a-only.txt")
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("long branches only occupy remaining width and cannot squeeze the repository count or gap", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-repo-branch-width-"))
  const host = mockHost(root)
  const branch = "feat/dev-core-fitness-fix-a-very-long-branch-name"
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({
    repository: true,
    repositories: [{ id: "fitness", root, name: "fitness", branch }],
    files: Array.from({ length: 12 }, (_, index) => ({ path: `${index}.txt`, file: `${index}.txt`, area: "changes" as const, status: "modified" as const, repositoryRoot: root, additions: 1, deletions: 0 })),
  }))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <ChangesPane controller={controller} fill onFocus={() => {}} focusTree={() => {}} releaseFocus={() => {}} />
  }, { width: 42, height: 20 })
  try {
    await controller.changes.refresh()
    for (const width of [42, 28, 20, 42]) {
      setup.renderer.resize(width, 20)
      await setup.renderOnce(); await setup.renderOnce()
      const header = setup.captureCharFrame().split("\n").find((line) => line.includes("● ▾ fitness"))!
      expect(header).toContain("● ▾ fitness (12)  ")
      expect(header).not.toContain(branch)
      const row = setup.renderer.root.findDescendantById("oec-diff-row:repo:fitness")!
      const [label, branchBox] = row.getChildren()
      expect(branchBox!.screenX).toBeGreaterThanOrEqual(label!.screenX + label!.width + 2)
      expect(branchBox!.screenX + branchBox!.width).toBeLessThanOrEqual(row.screenX + row.width)
      expect(row.height).toBe(1)
    }
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("F6 preserves panels; F7 Files and F8 Diff toggle independently without losing documents", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-panel-keys-"))
  await writeFile(join(root, "open.txt"), "saved")
  const host = mockHost(root)
  const projects = new EditorProjects(host.context)
  try {
    await projects.toggle()
    const controller = projects.current()!
    expect(controller.editorFilesVisible).toBe(true)
    expect(controller.filesVisible).toBe(false)
    expect(controller.diffVisible).toBe(true)
    await controller.workspace.open(join(root, "open.txt"))
    controller.workspace.edit(controller.workspace.activePath!, "unsaved")
    await projects.toggleFiles()
    expect(controller.editorFilesVisible).toBe(false)
    await projects.toggle()
    expect(host.context.ui.router.current().type).toBe("session")
    expect(controller.diffVisible).toBe(true)
    expect(controller.filesVisible).toBe(false)
    await projects.toggleFiles()
    expect(controller.filesVisible).toBe(true)
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(false)
    expect(controller.filesVisible).toBe(true)
    await projects.toggle()
    expect(controller.diffVisible).toBe(false)
    await projects.toggleFiles()
    expect(controller.editorFilesVisible).toBe(true)
    await projects.toggleDiff()
    await projects.toggle(); await projects.toggle()
    expect(controller.editorFilesVisible).toBe(true)
    expect(controller.diffVisible).toBe(true)
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
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files: host.vcs.files.map((file) => ({ ...file, path: file.file, area: "changes" as const })) }))
  await controller.toggleFiles()
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
    const input = get("oec-files-search")!
    const mode = get("oec-search-mode")!
    expect(mode.screenY).toBe(input.screenY)
    expect(mode.screenX).toBeGreaterThanOrEqual(input.screenX + input.width)
    expect(mode.width).toBeLessThanOrEqual(11)
    const lines = setup.captureCharFrame().split("\n")
    const diffRow = lines.findIndex((line) => line.includes("▾ Diff"))
    expect(diffRow).toBeGreaterThan(0)
    expect(get("oec-panels-gap")!.height).toBe(1)
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
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files: host.vcs.files.map((file) => ({ ...file, path: file.file, area: "changes" as const })) }))
  await controller.enter("session-1")
  await controller.workspace.open(join(root, "visible.txt"))
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
    expect(tree.screenY + tree.height).toBeLessThanOrEqual(header.screenY - 1)
    expect(diff.screenY + diff.height).toBeLessThanOrEqual(height - 1)
    diff.focus()
    await setup.renderOnce()
    controller.toggleDiff()
    await setup.renderOnce()
    expect((setup.renderer.root.findDescendantById("oec-editor-buffer") as TextareaRenderable).focused).toBe(true)
    controller.toggleDiff()
    await setup.renderOnce()
    expect(host.context.ui.router.current().type).toBe("plugin")
    expect(host.dispatches).toEqual([])
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test.each([false, true])("F7 hides the complete Files section independently from its accordion (editor=%s)", async (editor) => {
  const root = await mkdtemp(join(tmpdir(), "oec-files-visible-"))
  await writeFile(join(root, "file.ts"), "text")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files: [] }))
  await controller.toggleFiles()
  if (editor) { await controller.enter("session-1"); await controller.workspace.open(join(root, "file.ts")) }
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return editor ? <EditorRoute controller={controller} /> : <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 100, height: 32 })
  const get = (id: string) => setup.renderer.root.findDescendantById(id)
  const toggleFiles = () => editor ? controller.toggleEditorFiles() : controller.toggleFiles()
  const frames = async () => { await setup.renderOnce(); await setup.renderOnce() }
  try {
    await controller.tree.refresh(); await controller.changes.refresh(); await frames()
    expect(controller.diffVisible).toBe(true)
    expect(get("oec-diff-toggle")).toBeDefined()
    expect(get("oec-files-toggle")).toBeDefined()
    await setup.mockMouse.click(get("oec-files-toggle")!.screenX + 2, get("oec-files-toggle")!.screenY); await frames()
    expect(controller.filesExpanded).toBe(false)
    expect(get("oec-files-toggle")).toBeDefined()
    expect(get("oec-files-pane")).toBeUndefined()
    await toggleFiles(); await frames()
    expect(get("oec-files-section")).toBeUndefined()
    expect(get("oec-files-toggle")).toBeUndefined()
    expect(get("oec-files-search")).toBeUndefined()
    expect(get("oec-panels-gap")).toBeUndefined()
    expect(get("oec-diff-toggle")).toBeDefined()
    await toggleFiles(); await frames()
    expect(get("oec-files-toggle")).toBeDefined()
    expect(get("oec-files-pane")).toBeUndefined()
    controller.toggleFilesExpanded(); await controller.tree.refresh(); await frames()
    expect(get("oec-files-pane")).toBeDefined()
    get("oec-files-search")!.focus()
    await toggleFiles(); await frames()
    expect(get("oec-files-toggle")).toBeUndefined()
    expect(get("oec-changes-pane")!.focused).toBe(true)
    controller.toggleDiff(); await frames()
    expect(get("oec-project-panels")).toBeUndefined()
    if (editor) expect(get("oec-editor-buffer")!.focused).toBe(true)
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})
