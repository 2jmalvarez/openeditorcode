/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { EditorRoute } from "../src/workbench/EditorRoute"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"
import type { ScrollBoxRenderable } from "@opentui/core"

test.each([false, true])("expanded panels share remaining space and redistribute on collapse/hide (editor=%s)", async (editor) => {
  const root = await mkdtemp(join(tmpdir(), "oec-panel-height-"))
  await writeFile(join(root, "file.ts"), "source")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files: [] }))
  await controller.toggleFiles()
  if (editor) { await controller.enter("session-1"); await controller.workspace.open(join(root, "file.ts")) }
  const [header, setHeader] = createSignal(12)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return editor ? <EditorRoute controller={controller} /> : <box height="100%" flexDirection="column">
      <box height={header()} flexShrink={0}><text>Host title and MCP</text></box>
      <SessionFiles controller={controller} sessionID="session-1" />
      <box height={2} flexShrink={0}><text>Footer</text></box>
    </box>
  }, { width: 100, height: 60 })
  const get = (id: string) => setup.renderer.root.findDescendantById(id)!
  const frames = async () => { for (let i = 0; i < 4; i++) await setup.renderOnce() }
  const bottom = (id: string) => get(id).screenY + get(id).height
  const balanced = () => {
    expect(Math.abs(get("oec-files-section").height - get("oec-diff-section").height)).toBeLessThanOrEqual(1)
    expect(bottom("oec-files-section")).toBeLessThan(get("oec-diff-section").screenY)
    expect(bottom("oec-diff-section")).toBe(bottom("oec-project-panels"))
    expect(get("oec-changes-pane").height).toBeGreaterThan(8)
  }
  try {
    await frames()
    balanced()
    if (!editor) {
      expect(bottom("oec-project-panels")).toBe(58)
      setHeader(19)
      await frames()
      expect(get("oec-project-panels").screenY).toBe(19)
      expect(bottom("oec-project-panels")).toBe(58)
    }
    const half = get("oec-changes-pane").height
    controller.toggleFilesExpanded()
    await frames()
    expect(get("oec-files-section").height).toBe(1)
    expect(get("oec-changes-pane").height).toBeGreaterThan(half)
    expect(bottom("oec-changes-pane")).toBe(bottom("oec-project-panels"))
    controller.toggleDiffExpanded()
    await frames()
    expect(get("oec-files-section").height).toBe(1)
    expect(get("oec-diff-section").height).toBe(1)
    if (!editor) expect(get("oec-project-panels").height).toBe(3)
    controller.toggleFilesExpanded()
    await frames()
    expect(get("oec-files-section").height).toBeGreaterThan(half)
    expect(get("oec-diff-section").height).toBe(1)
    controller.toggleDiff()
    await frames()
    expect(bottom("oec-files-section")).toBe(bottom("oec-project-panels"))
    controller.toggleDiff()
    if (editor) await controller.toggleEditorFiles(); else await controller.toggleFiles()
    await frames()
    expect(get("oec-files-section")).toBeUndefined()
    expect(get("oec-diff-section").height).toBe(get("oec-project-panels").height)
    if (editor) await controller.toggleEditorFiles(); else await controller.toggleFiles()
    setup.resize(100, 42)
    await frames()
    expect(bottom("oec-project-panels")).toBeLessThanOrEqual(42)
    expect(Math.abs(get("oec-files-section").height - get("oec-diff-section").height)).toBeLessThanOrEqual(1)
    controller.togglePanelHeight()
    await frames()
    expect(controller.options.panelHeight).toBe("compact")
    expect(get("oec-changes-pane").height).toBeLessThanOrEqual(8)
    if (!editor) expect(get("oec-files-section").height).toBeLessThanOrEqual(11)
    controller.togglePanelHeight()
    setup.resize(100, 60)
    await frames()
    balanced()
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("expanded panels obey the outer viewport, padding and chrome; outer scrolling cannot increase their height", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-panel-viewport-"))
  await Promise.all(Array.from({ length: 60 }, (_, i) => writeFile(join(root, `file-${i}.ts`), "source")))
  const host = mockHost(root)
  const files = Array.from({ length: 60 }, (_, i) => ({ file: `file-${i}.ts`, path: `file-${i}.ts`, status: "modified" as const, area: "changes" as const, additions: 1, deletions: 2 }))
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files }))
  await controller.toggleFiles()
  const [chrome, setChrome] = createSignal(8)
  const [contextHeight, setContextHeight] = createSignal(10)
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <box height="100%" flexDirection="column">
      <box height={chrome()} flexShrink={0}><text>Multiline title and Context</text></box>
      <scrollbox id="outer-viewport" flexGrow={1} flexBasis={0} minHeight={0} scrollY contentOptions={{ paddingBottom: 1 }}>
        <box height={contextHeight()} flexShrink={0}><text>Six MCP servers</text></box>
        <box flexShrink={0}><SessionFiles controller={controller} sessionID="session-1" /></box>
      </scrollbox>
      <box height={6} flexShrink={0}><text>Getting started and footer</text></box>
    </box>
  }, { width: 55, height: 60 })
  const get = (id: string) => setup.renderer.root.findDescendantById(id)!
  const scroll = (id: string) => get(id) as ScrollBoxRenderable
  const frames = async () => { for (let i = 0; i < 6; i++) await setup.renderOnce() }
  const check = () => {
    const outer = scroll("outer-viewport")
    expect(outer.scrollHeight).toBeLessThanOrEqual(outer.viewport.height)
    expect(scroll("oec-files-scroll").viewport.height).toBe(scroll("oec-diff-scroll").viewport.height)
    expect(scroll("oec-files-scroll").verticalScrollBar.screenX).toBe(scroll("oec-diff-scroll").verticalScrollBar.screenX)
    expect(scroll("oec-files-scroll").verticalScrollBar.width).toBe(scroll("oec-diff-scroll").verticalScrollBar.width)
  }
  try {
    await controller.changes.refresh(); await frames(); check()
    setChrome(14); await frames(); check()
    setup.resize(55, 50); await frames(); check()
    await controller.fileSearch.search("file")
    await frames(); check()
    await controller.fileSearch.search("")
    setContextHeight(45)
    await frames()
    const outer = scroll("outer-viewport")
    expect(outer.scrollHeight).toBeGreaterThan(outer.viewport.height)
    const bounded = get("oec-project-panels").height
    outer.scrollTop = 20
    await frames()
    expect(get("oec-project-panels").height).toBe(bounded)
    outer.scrollTop = 0; setContextHeight(10); setChrome(8)
    setup.resize(55, 60); await frames(); check()
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
})
