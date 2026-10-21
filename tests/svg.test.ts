import { expect, test } from "bun:test"
import { MAX_FILE_BYTES } from "../src/documents/files"
import { MAX_SVG_DIMENSION, renderSvg } from "../src/documents/svg"

const svg = (body: string, size = 'width="32" height="24"') => `<svg xmlns="http://www.w3.org/2000/svg" ${size}>${body}</svg>`
function pngSize(bytes: Uint8Array) {
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

test("renders SVG drafts into PNG and initializes the portable backend once for concurrent previews", async () => {
  const [red, blue] = await Promise.all([
    renderSvg(svg('<rect width="32" height="24" fill="red"/>')),
    renderSvg(svg('<rect width="32" height="24" fill="blue"/>')),
  ])
  expect(pngSize(red)).toEqual([32, 24])
  expect(pngSize(blue)).toEqual([32, 24])
  expect(red).not.toEqual(blue)
})

test("renders text using an embedded font without depending on installed system fonts", async () => {
  const blank = await renderSvg(svg(""))
  const text = await renderSvg(svg('<text x="0" y="18" fill="white">SVG</text>'))
  expect(text).not.toEqual(blank)
})

test("bounds both landscape and portrait raster dimensions", async () => {
  expect(pngSize(await renderSvg(svg("", 'width="100000" height="50000"')))).toEqual([MAX_SVG_DIMENSION, MAX_SVG_DIMENSION / 2])
  expect(pngSize(await renderSvg(svg("", 'width="50000" height="100000"')))).toEqual([MAX_SVG_DIMENSION / 2, MAX_SVG_DIMENSION])
})

test("rejects invalid, oversized or entity-bearing SVG while subsequent previews still work", async () => {
  for (const input of ["", "<svg>", "not SVG", '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]>' + svg("&x;"), " ".repeat(MAX_FILE_BYTES + 1)]) {
    await expect(renderSvg(input)).rejects.toThrow()
  }
  expect(pngSize(await renderSvg(svg("")))).toEqual([32, 24])
})

test("does not load external image files or network resources", async () => {
  const blank = await renderSvg(svg(""))
  for (const href of ["https://example.invalid/private.png", "file:///secret.png", "../secret.png"]) {
    const result = await renderSvg(svg(`<image href="${href}" width="32" height="24"/>`))
    expect(result).toEqual(blank)
  }
})
