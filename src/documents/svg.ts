import { initWasm, Resvg } from "@resvg/resvg-wasm"
import { MAX_FILE_BYTES, readSvgAssets } from "./files"

export const MAX_SVG_DIMENSION = 1600
let initialized: Promise<Uint8Array> | undefined

function initialize(): Promise<Uint8Array> {
  return initialized ??= readSvgAssets().then(async ({ wasm, font }) => {
    await initWasm(wasm)
    return font
  })
}

/** Static, in-memory rendering: no scripts, network requests or external files. */
export async function renderSvg(source: string): Promise<Uint8Array> {
  if (Buffer.byteLength(source, "utf8") > MAX_FILE_BYTES) throw new Error("SVG exceeds the text file limit")
  // Do not allow XML entities/DTDs. The WASM backend cannot access the host
  // filesystem and external images are deliberately never resolved.
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("SVG document types and entities are not supported")
  const font = await initialize()
  const options = { font: { fontBuffers: [font], defaultFontFamily: "DejaVu Sans" } }
  const original = new Resvg(source, options)
  let fitted: InstanceType<typeof Resvg> | undefined
  let image: ReturnType<InstanceType<typeof Resvg>["render"]> | undefined
  try {
    const size = Math.max(original.width, original.height)
    if (!Number.isFinite(size) || size <= 0) throw new Error("Invalid SVG dimensions")
    fitted = new Resvg(source, { ...options, fitTo: { mode: "zoom", value: Math.min(1, MAX_SVG_DIMENSION / size) } })
    // Resvg.width/height describe the SVG, not the fitted raster dimensions.
    image = fitted.render()
    return image.asPng()
  } finally {
    image?.free()
    fitted?.free()
    original.free()
  }
}
