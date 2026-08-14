import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRoot } from "solid-js"
import { createGitignore, parseGitignore } from "../src/explorer/gitignore"
import { useSearchExclusions } from "../src/search/useSearchExclusions"

let root = ""

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-exclusions-"))
  await writeFile(join(root, ".gitignore"), "dist/\n*.log\n!important.log\n", "utf8")
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

test("uses gitignore as the session base and allows temporary overrides", async () => {
  const state = createRoot((dispose) => ({ exclusions: useSearchExclusions(root), dispose }))
  await state.exclusions.load()

  expect(state.exclusions.rules().ignores("dist/output.js")).toBe(true)
  expect(state.exclusions.rules().ignores("debug.log")).toBe(true)
  expect(state.exclusions.rules().ignores("important.log")).toBe(false)

  state.exclusions.toggle("dist/")
  state.exclusions.toggle("coverage/")

  expect(state.exclusions.rules().ignores("dist/output.js")).toBe(false)
  expect(state.exclusions.rules().ignores("coverage/report.txt")).toBe(true)
  expect(state.exclusions.suggestions("dist")[0]).toMatchObject({ pattern: "dist/", source: "gitignore", excluded: false })
  state.dispose()
})

test("autocompletes project directories without allowing .git", async () => {
  const state = createRoot((dispose) => ({ exclusions: useSearchExclusions(root), dispose }))
  await state.exclusions.load()
  state.exclusions.setDirectoryCandidates(["src", ".git"])

  expect(state.exclusions.suggestions("src")).toContainEqual({ pattern: "src/", source: "project", excluded: false })
  expect(state.exclusions.suggestions("git").some((item) => item.pattern === ".git/")).toBe(false)
  expect(state.exclusions.toggle(".git/")).toBe(false)
  state.dispose()
})

test("preserves significant whitespace and escaped comments in gitignore patterns", () => {
  const patterns = parseGitignore("# comment\nname\\ \n\\#secret\n")
  const rules = createGitignore(patterns)

  expect(patterns).toEqual(["name\\ ", "\\#secret"])
  expect(rules.ignores("name ")).toBe(true)
  expect(rules.ignores("#secret")).toBe(true)
})
