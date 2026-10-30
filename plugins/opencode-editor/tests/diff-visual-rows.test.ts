import { expect, test } from "bun:test"
import { diffVisualRows } from "../src/changes/visual-rows"
import { changeTree } from "../src/changes/tree"
import { createDiffViewState } from "../src/changes/view-state"

test("wrapped repository lines retain every character, counts, and logical selection", () => {
  const name = "equipo/非常長的名称/backend-🦊-é"
  const repository = { id: "one", root: "/one", name, branch: "main" }
  const files = [{ file: "dir/file", path: "dir/file", repositoryRoot: "/one", area: "changes" as const, status: "modified" as const, additions: 1, deletions: 0 }]
  const tree = changeTree(files, new Set(), [repository])
  const visual = diffVisualRows(tree, 12, true)
  const lines = visual.filter((line) => line.index === 0)
  expect(lines.map((line) => line.label).join("")).toBe(`▾ (1) ${name}`)
  expect(lines.map((line) => line.branch).join("")).toBe("main")
  expect(lines.every((line) => Bun.stringWidth(line.label) <= 10)).toBe(true)
  expect(lines.filter((line) => line.last)).toHaveLength(1)
  expect(visual.find((line) => line.row.name === "file")?.index).toBe(2)
  expect(diffVisualRows(tree, 12, false)).toHaveLength(tree.length)
})

test("branches wrap after repository labels without losing Unicode or branch fallback text", () => {
  for (const name of ["repo", "team/repository-with-a-very-long-name"]) for (const branch of ["feat/非常長的名称/🦊-é-long-branch", ""]) {
    const tree = changeTree([], new Set(), [{ id: "repo", root: "/repo", name, branch }])
    for (const width of [12, 20, 42, 80]) {
      const lines = diffVisualRows(tree, width, true).filter((line) => line.row.repository)
      expect(lines.map((line) => line.label).join("")).toBe(`▾ ${name}`)
      expect(lines.map((line) => line.branch).join("")).toBe(branch || "Branch unavailable")
      expect(lines.every((line) => 2 + Bun.stringWidth(line.label) + (line.branch ? 2 + Bun.stringWidth(line.branch) : 0) <= width)).toBe(true)
      const unwrapped = diffVisualRows(tree, width, false).filter((line) => line.row.repository)
      expect(unwrapped).toHaveLength(1)
      expect(unwrapped[0]!.branch).toBe(branch || "Branch unavailable")
    }
  }
})

test("collapse all includes nested folders and preserves independent wrapping preference", () => {
  const view = createDiffViewState()
  const files = [{ file: "a/b/file", path: "a/b/file", area: "changes" as const, status: "modified" as const, additions: 1, deletions: 0 }]
  view.toggleWrap()
  view.collapseAll(files, [])
  expect([...view.collapsed()]).toEqual(["dir:a", "dir:a/b"])
  expect(changeTree(files, view.collapsed()).map((row) => row.name)).toEqual(["a"])
  expect(view.wrap()).toBe(false)
})
