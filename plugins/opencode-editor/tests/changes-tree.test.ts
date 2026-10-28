import { expect, test } from "bun:test"
import { changeTree } from "../src/changes/tree"
import type { Change } from "../src/changes/git"

test("Diff tree groups folders, retains staged/working identities, and independently collapses ancestors", () => {
  const file = (path: string, area: Change["area"] = "changes"): Change => ({ file: path, path, area, status: "modified", additions: 1, deletions: 2 })
  const files = [file("src/editor/file.ts"), file("src/editor/file.ts", "staged"), file("README.md"), file("src/other.ts")]
  const rows = changeTree(files)
  expect(rows.map((row) => row.name)).toEqual(["src", "editor", "file.ts", "file.ts", "other.ts", "README.md"])
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  expect(rows.filter((row) => row.change).map((row) => row.change?.area)).toContain("staged")
  expect(changeTree(files, new Set(["dir:src/editor"])).map((row) => row.name)).toEqual(["src", "editor", "other.ts", "README.md"])
  expect(changeTree(files, new Set(["dir:src"])).map((row) => row.name)).toEqual(["src", "README.md"])
  expect(rows.find((row) => row.name === "file.ts")?.parent).toBe("dir:src/editor")
})

test("repositories retain branches when collapsed and isolate same-named files and folders", () => {
  const repositories = [
    { id: "a", root: "/workspace/a", name: "a", branch: "main" },
    { id: "b", root: "/workspace/b", name: "b", branch: "feature/test" },
    { id: "clean", root: "/workspace/clean", name: "clean", branch: "develop" },
  ]
  const files: Change[] = repositories.slice(0, 2).map((repo) => ({ file: "src/shared.ts", path: "src/shared.ts", area: "changes", status: "modified", repositoryRoot: repo.root, additions: 1, deletions: 0 }))
  const rows = changeTree(files, new Set(), repositories)
  expect(rows.filter((row) => row.repository).map((row) => row.name)).toEqual(["a", "b", "clean"])
  expect(rows.filter((row) => row.change)).toHaveLength(2)
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  expect(rows.find((row) => row.name === "No changes")?.parent).toBe("repo:clean")
  const collapsed = changeTree(files, new Set(["repo:a", "repo:b:dir:src"]), repositories)
  expect(collapsed.find((row) => row.id === "repo:a")?.repository?.branch).toBe("main")
  expect(collapsed.some((row) => row.id.endsWith(":branch"))).toBe(false)
  expect(collapsed.filter((row) => row.change)).toHaveLength(0)
  expect(collapsed.find((row) => row.id === "repo:b:dir:src")?.expanded).toBe(false)
  const unusual = changeTree(files, new Set(), [...repositories, { id: "a:dir:src", root: "/workspace/a:dir:src", name: "a:dir:src", branch: "main" }])
  expect(new Set(unusual.map((row) => row.id)).size).toBe(unusual.length)
})

test("repository counts include unique paths, not staged/working duplicates, even when collapsed", () => {
  const repositories = [
    { id: "a", root: "/workspace/a", name: "a", branch: "main" },
    { id: "b", root: "/workspace/b", name: "b", branch: "main" },
  ]
  const file = (path: string, area: Change["area"]): Change => ({ file: path, path, area, status: "modified", repositoryRoot: "/workspace/a", additions: 1, deletions: 0 })
  const rows = changeTree([file("shared.ts", "staged"), file("shared.ts", "changes"), file("other.ts", "changes")], new Set(["repo:a"]), repositories)
  expect(rows.find((row) => row.id === "repo:a")?.changedFiles).toBe(2)
  expect(rows.find((row) => row.id === "repo:b")?.changedFiles).toBe(0)
})
