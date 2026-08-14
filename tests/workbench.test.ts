import { expect, test } from "bun:test"
import { refreshFocusedPanel } from "../src/workbench/refresh"
import { canShowBothSidePanels, editorWidth, EXPLORER_WIDTH, GIT_WIDTH, MIN_EDITOR_WIDTH } from "../src/workbench/layout"

test("refreshes Git instead of the explorer when the changes panel is active", async () => {
  const calls: string[] = []
  await refreshFocusedPanel(
    "git",
    async () => { calls.push("explorer") },
    async () => { calls.push("git") },
  )
  expect(calls).toEqual(["git"])
})

test("refreshes the explorer outside the changes panel", async () => {
  const calls: string[] = []
  await refreshFocusedPanel(
    "explorer",
    async () => { calls.push("explorer") },
    async () => { calls.push("git") },
  )
  expect(calls).toEqual(["explorer"])
})

test("reserves a usable editor width before showing both side panels", () => {
  const minimumWidth = EXPLORER_WIDTH + GIT_WIDTH + MIN_EDITOR_WIDTH
  expect(canShowBothSidePanels(minimumWidth - 1)).toBe(false)
  expect(canShowBothSidePanels(minimumWidth)).toBe(true)
  expect(editorWidth(minimumWidth, true, true)).toBe(MIN_EDITOR_WIDTH)
})
