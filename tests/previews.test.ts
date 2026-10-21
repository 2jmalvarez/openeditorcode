import { expect, test } from "bun:test"
import { isImagePath, isMarkdownPath, isSvgPath } from "../src/documents/previews"

test("classifies Markdown and supported image preview paths case-insensitively", () => {
  expect(isMarkdownPath("README.MD")).toBe(true)
  expect(isMarkdownPath("notes.txt")).toBe(false)
  expect(isImagePath("photo.JPEG")).toBe(true)
  expect(isImagePath("animation.gif")).toBe(true)
  expect(isImagePath("logo.svg")).toBe(false)
  expect(isSvgPath("logo.SVG")).toBe(true)
  expect(isSvgPath("logo.svg.png")).toBe(false)
})
