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
