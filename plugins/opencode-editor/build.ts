import solidPlugin from "@opentui/solid/bun-plugin"
import { fileURLToPath } from "node:url"
import { copyFile } from "node:fs/promises"
import { resolve } from "node:path"

const directory = fileURLToPath(new URL(".", import.meta.url))
const result = await Bun.build({
  entrypoints: [`${directory}src/tui.tsx`],
  outdir: `${directory}dist`,
  target: "bun",
  format: "esm",
  plugins: [solidPlugin, {
    name: "portable-svg-assets",
    setup(build) {
      build.onLoad({ filter: /[\\/]documents[\\/]svg-assets\.ts$/ }, () => ({
        loader: "js",
        contents: 'export const svgWasmPath = new URL("./svg.wasm", import.meta.url); export const svgFontPath = new URL("./svg-font.ttf", import.meta.url);',
      }))
    },
  }],
  external: ["@opencode/plugin", "@opencode/plugin/*", "@opentui/core", "@opentui/core/*", "@opentui/solid", "@opentui/solid/*", "solid-js", "solid-js/*"],
  sourcemap: "none",
})
if (!result.success) throw new AggregateError(result.logs, "Could not build the OEC plugin")
await Promise.all([
  copyFile(Bun.resolveSync("@resvg/resvg-wasm/index_bg.wasm", directory), `${directory}dist/svg.wasm`),
  copyFile(Bun.resolveSync("dejavu-fonts-ttf/ttf/DejaVuSans.ttf", directory), `${directory}dist/svg-font.ttf`),
  copyFile(resolve(directory, "../../docs/THIRD-PARTY-NOTICES.txt"), `${directory}THIRD-PARTY-NOTICES.txt`),
])
