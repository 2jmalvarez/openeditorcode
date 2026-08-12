import { expect, test } from "bun:test"
import { refreshFocusedPanel } from "../src/workbench/refresh"

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
