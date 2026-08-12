/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { writeFileSync } from "node:fs"
import { resolveRoot } from "./bootstrap/resolve-root"
import { App } from "./workbench/App"

// Ctrl+C belongs to the editor for copying selected text.
const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  // Preserve Shift+Enter and Ctrl+Shift+Z instead of collapsing them into plain Enter/Ctrl+Z.
  useKittyKeyboard: { allKeysAsEscapes: true, alternateKeys: true, disambiguate: true },
})
if (process.env.OEC_TUI_SMOKE === "1") {
  renderer.once("frame", () => {
    if (process.env.OEC_TUI_SMOKE_MARKER) writeFileSync(process.env.OEC_TUI_SMOKE_MARKER, "ready")
    renderer.destroy()
  })
}
await render(() => <App root={resolveRoot(process.argv[2])} />, renderer)
