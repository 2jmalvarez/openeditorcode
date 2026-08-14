import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { useActivity } from "../src/workbench/useActivity"

test("keeps the footer activity busy until concurrent operations finish", async () => {
  let finishFirst!: () => void
  let finishSecond!: () => void
  const first = new Promise<void>((resolve) => { finishFirst = resolve })
  const second = new Promise<void>((resolve) => { finishSecond = resolve })

  const state = createRoot((dispose) => ({ activity: useActivity(), dispose }))
  const firstRun = state.activity.run("Primera actividad...", () => first)
  const secondRun = state.activity.run("Segunda actividad...", () => second)

  expect(state.activity.busy()).toBe(true)
  expect(state.activity.message()).toBe("Segunda actividad...")
  finishSecond()
  await secondRun
  expect(state.activity.busy()).toBe(true)
  expect(state.activity.message()).toBe("Primera actividad...")
  finishFirst()
  await firstRun
  expect(state.activity.busy()).toBe(false)
  state.dispose()
})
