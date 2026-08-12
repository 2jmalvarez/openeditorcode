import { expect, test } from "bun:test"
import { isNewerVersion } from "../src/updates/version"

test("detects newer semantic versions", () => {
  expect(isNewerVersion("0.2.3", "0.2.4")).toBe(true)
  expect(isNewerVersion("0.2.3", "0.3.0")).toBe(true)
  expect(isNewerVersion("0.2.3", "1.0.0")).toBe(true)
})

test("rejects equal, older, and invalid versions", () => {
  expect(isNewerVersion("0.2.3", "0.2.3")).toBe(false)
  expect(isNewerVersion("0.2.3", "0.2.2")).toBe(false)
  expect(isNewerVersion("0.2.3", "latest")).toBe(false)
})

test("orders prerelease versions below stable releases", () => {
  expect(isNewerVersion("1.0.0-beta.1", "1.0.0")).toBe(true)
  expect(isNewerVersion("1.0.0", "1.0.1-beta.1")).toBe(true)
  expect(isNewerVersion("1.0.0", "1.0.0-beta.1")).toBe(false)
})
