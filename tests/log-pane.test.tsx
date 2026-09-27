/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import type { TextareaRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { LogPane, logText } from "../src/logs/LogPane"
import type { LogEntry } from "../src/logs/useLogs"

const entry: LogEntry = {
  id: 1,
  timestamp: new Date("2026-09-27T15:47:45"),
  source: "Sistema",
  operation: "Abrir carpeta del proyecto",
  summary: "Folder launcher exited with code 1",
  details: "at DQA",
}

test("renders live log text in a selectable viewer", async () => {
  const [entries, setEntries] = createSignal([entry])
  let viewer: TextareaRenderable | undefined
  const setup = await testRender(() => <LogPane entries={entries} active={() => true} setViewer={(value) => { viewer = value }} />, { width: 80, height: 12 })
  try {
    await setup.renderOnce()
    expect(viewer?.plainText).toBe(logText([entry]))
    viewer!.setSelection(0, 8)
    expect(viewer!.getSelectedText()).toBe(viewer!.plainText.slice(0, 8))

    const next = { ...entry, id: 2, summary: "Otro error" }
    setEntries([entry, next])
    await setup.renderOnce()
    expect(viewer?.plainText).toBe(logText([entry, next]))
  } finally {
    setup.renderer.destroy()
  }
})
