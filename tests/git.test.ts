import { expect, test } from "bun:test"
import { parseGitStatus } from "../src/git/status"
import { alignDiff } from "../src/git/DiffPane"
import type { OpenTab } from "../src/documents/types"
import { createGitTree } from "../src/git/tree"

test("parses porcelain Git states including renamed paths", () => {
  expect(parseGitStatus(" M notes.txt\0A  added.ts\0D  deleted.ts\0R  renamed.ts\0old-name.ts\0?? new.txt\0")).toEqual([
    { path: "added.ts", status: "added" },
    { path: "deleted.ts", status: "deleted" },
    { path: "new.txt", status: "untracked" },
    { path: "notes.txt", status: "modified" },
    { path: "renamed.ts", status: "renamed" },
  ])
})

test("aligns removed and added lines into matching diff rows", () => {
  expect(alignDiff("one\ntwo\nthree\n", "one\nchanged\nthree\n")).toEqual([
    [
      { number: 1, text: "one", changed: false },
      { number: 2, text: "two", changed: true },
      { number: 3, text: "three", changed: false },
    ],
    [
      { number: 1, text: "one", changed: false },
      { number: 2, text: "changed", changed: true },
      { number: 3, text: "three", changed: false },
    ],
  ])
})

test("distinguishes file and diff tabs for the same path", () => {
  const tabs: OpenTab[] = [
    { kind: "file", path: "README.md", content: "working copy", savedContent: "working copy" },
    { kind: "diff", path: "README.md", diff: { file: { path: "README.md", status: "modified" }, previous: "before", current: "after" } },
  ]
  expect(tabs.map((tab) => tab.kind)).toEqual(["file", "diff"])
})

test("groups changed files into expandable folders", () => {
  const files = [{ path: "src/editor/app.ts", status: "modified" as const }, { path: "src/workbench/layout.tsx", status: "added" as const }]
  expect(createGitTree(files, new Set(["src"])).map((item) => [item.name, item.depth])).toEqual([["src", 0], ["editor", 1], ["workbench", 1]])
})
