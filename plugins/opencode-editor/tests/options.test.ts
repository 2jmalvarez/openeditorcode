import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { parseOptions } from "../src/integration/options"

test("defaults to the active directory and retains an optional absolute override", () => {
  expect(() => parseOptions({})).toThrow("localRoot")
  expect(() => parseOptions({ localRoot: "relative" })).toThrow("localRoot")
  expect(() => parseOptions({ localRoot: null }, resolve("project"))).toThrow("localRoot")
  expect(parseOptions({}, resolve("project")).localRoot).toBe(resolve("project"))
  expect(parseOptions({ localRoot: resolve("override") }, resolve("project")).localRoot).toBe(resolve("override"))
  expect(parseOptions({ localRoot: resolve(".") }).toggleBinding).toBe("ctrl+alt+o")
  expect(() => parseOptions({ localRoot: resolve("."), explorerWidth: 0 })).toThrow("explorerWidth")
})
