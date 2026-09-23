import { expect, test } from "bun:test"
import { sortMassiveFiles } from "../src/search/project-search"

test("sorts text files by descending line count and excludes uncounted files", () => {
  const files = sortMassiveFiles([
    { path: "src/small.ts", name: "small.ts", directory: false },
    { path: "src/folder", name: "folder", directory: true },
    { path: "src/large.ts", name: "large.ts", directory: false },
    { path: "assets/image.png", name: "image.png", directory: false },
  ], { "src/small.ts": 4, "src/large.ts": 80 })

  expect(files).toEqual([
    { path: "src/large.ts", name: "large.ts", lines: 80 },
    { path: "src/small.ts", name: "small.ts", lines: 4 },
  ])
})
