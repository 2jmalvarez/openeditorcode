import solidPlugin from "@opentui/solid/bun-plugin"
import { fileURLToPath } from "node:url"

const directory = fileURLToPath(new URL(".", import.meta.url))
const result = await Bun.build({
  entrypoints: [`${directory}src/tui.tsx`],
  outdir: `${directory}dist`,
  target: "bun",
  format: "esm",
  plugins: [solidPlugin],
  external: ["@opencode/plugin", "@opencode/plugin/*", "@opentui/core", "@opentui/core/*", "@opentui/solid", "@opentui/solid/*", "solid-js", "solid-js/*"],
  sourcemap: "none",
})
if (!result.success) throw new AggregateError(result.logs, "Could not build the OEC plugin")
