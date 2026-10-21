/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { RGBA } from "@opentui/core"
import { testRender, useRenderer } from "@opentui/solid"
import { ChangesPane } from "../src/changes/ChangesPane"
import { changePresentation } from "../src/changes/presentation"
import type { Change } from "../src/changes/git"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"

const statuses = ["untracked", "added", "deleted", "modified", "renamed"] as const
const files: Change[] = statuses.flatMap(status => (["changes", "staged"] as const).map(area => ({
  file: `${area}-${status}.ts`, path: `${area}-${status}.ts`, status, area, additions: status === "untracked" ? null : 3, deletions: 2,
})))

test("Diff presentation retains status symbols and gives staging priority over change type", () => {
  for (const file of files) {
    const label = changePresentation(file)
    expect(label.symbol).toBe(file.area === "staged" ? "●" : "○")
    expect(label.indicator).toBe(file.area === "staged" ? "staged" : label.tone)
    expect(label.tone).toBe(file.status === "deleted" ? "removed" : ["untracked", "added"].includes(file.status) ? "added" : "modified")
    expect(label.status).toBe(file.status === "untracked" ? "?" : file.status[0].toUpperCase())
    expect(label.additions).toBe(file.status === "untracked" ? "+?" : "+3")
    expect(label.deletions).toBe("−2")
  }
})

test("Diff renders theme-colored indicators, status letters and independent +/- chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-diff-colors-"))
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root }), async () => ({ repository: true, files }))
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <ChangesPane controller={controller} height={20} onFocus={() => {}} focusTree={() => {}} releaseFocus={() => {}} />
  }, { width: 80, height: 25 })
  const palette = { added: "#98c379", removed: "#e06c75", modified: "#e5c07b", staged: "#61afef" }
  try {
    await controller.changes.refresh()
    for (let i = 0; i < 4; i++) await setup.renderOnce()
    const lines = setup.captureSpans().lines
    for (const file of files) {
      const expected = changePresentation(file)
      const label = lines.find(line => line.spans.map(span => span.text).join("").includes(file.file))!
      expect(label, file.file).toBeDefined()
      for (const [text, color] of [[expected.symbol, palette[expected.indicator]], [expected.status, palette[expected.tone]], [expected.additions, palette.added], [expected.deletions, palette.removed]]) {
        const chunk = label.spans.find(chunk => chunk.text.includes(text!))!
        expect(chunk, `${file.file}: ${text}`).toBeDefined()
        expect(chunk.fg).toEqual(RGBA.fromHex(color!))
      }
    }
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }) }
})
