/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender, useRenderer } from "@opentui/solid"
import { InitialPanels } from "../src/explorer/InitialPanels"
import { EditorProjects } from "../src/integration/projects"
import { mockHost } from "./host"

test.each(["files", "diff"] as const)("initial headers do not acquire local access; first %s activation respects consent", async (panel) => {
  const root = await mkdtemp(join(tmpdir(), "oec-initial-panels-"))
  const host = mockHost(root)
  const context = { ...host.context, options: {} }
  const projects = new EditorProjects(context)
  let pending: Promise<unknown> | undefined
  const setup = await testRender(() => {
    Object.defineProperty(context, "renderer", { value: useRenderer(), configurable: true })
    return <InitialPanels context={context} openFiles={() => { pending = projects.toggleFiles() }} openDiff={() => { pending = projects.toggleDiff() }} />
  }, { width: 40, height: 20 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("▸ Files")
    expect(setup.captureCharFrame()).toContain("▸ Diff")
    expect(projects.current()).toBeUndefined()
    expect(host.archives.size).toBe(0)
    expect(host.vcs.calls).toHaveLength(0)
    const target = setup.renderer.root.findDescendantById(`oec-${panel === "files" ? "files" : "diff"}-toggle`)!
    host.selections.push("deny")
    await setup.mockMouse.click(2, target.screenY)
    await Bun.sleep(0); await pending
    expect(projects.current()).toBeUndefined()
    expect(host.vcs.calls).toHaveLength(0)
    expect([...host.archives.keys()].every(key => key.startsWith("local-access.v1."))).toBe(true)
    host.selections.push("once")
    await setup.mockMouse.click(2, target.screenY)
    await Bun.sleep(0); await pending
    const controller = projects.current()!
    expect(controller).toBeDefined()
    expect(controller.filesVisible).toBe(true)
    expect(controller.filesExpanded).toBe(panel === "files")
    expect(controller.diffVisible).toBe(true)
    expect(controller.diffExpanded).toBe(true)
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(false)
    await projects.toggleDiff()
    expect(controller.diffVisible).toBe(true)
  } finally { setup.renderer.destroy(); await projects.dispose(); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
})
