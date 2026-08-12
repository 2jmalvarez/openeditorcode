import { expect, test } from "bun:test"
import { findMatches } from "../src/editor/find"

test("finds all local matches with stable positions", () => {
  expect(findMatches("uno dos\ndos tres\ndos", "dos")).toEqual([
    { offset: 4, line: 1, column: 5, preview: "uno dos" },
    { offset: 8, line: 2, column: 1, preview: "dos tres" },
    { offset: 17, line: 3, column: 1, preview: "dos" },
  ])
})

test("returns no local matches for an empty or absent query", () => {
  expect(findMatches("contenido", "")).toEqual([])
  expect(findMatches("contenido", "ausente")).toEqual([])
})
