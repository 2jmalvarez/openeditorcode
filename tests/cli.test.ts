import { expect, test } from "bun:test"
import { parseCli } from "../src/bootstrap/cli"

test("parses help, version, a project and dash-prefixed project paths", () => {
  expect(parseCli(["--help"])).toMatchObject({ exitCode: 0 })
  expect(parseCli(["--version"])).toMatchObject({ exitCode: 0 })
  expect(parseCli(["project"])).toEqual({ project: "project" })
  expect(parseCli(["--", "-project"])).toEqual({ project: "-project" })
})

test("rejects unknown options and multiple projects", () => {
  expect(parseCli(["--unknown"])).toMatchObject({ exitCode: 2 })
  expect(parseCli(["one", "two"])).toMatchObject({ exitCode: 2 })
})
