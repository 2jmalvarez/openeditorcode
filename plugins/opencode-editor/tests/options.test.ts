import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { parseOptions } from "../src/integration/options"

test("requires an explicit absolute local root", () => {
  expect(() => parseOptions({})).toThrow("localRoot")
  expect(() => parseOptions({ localRoot: "relative" })).toThrow("localRoot")
  expect(parseOptions({ localRoot: resolve(".") }).toggleBinding).toBe("ctrl+alt+o")
  expect(() => parseOptions({ localRoot: resolve("."), explorerWidth: 0 })).toThrow("explorerWidth")
})
