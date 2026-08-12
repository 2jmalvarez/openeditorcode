/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { resolveRoot } from "./bootstrap/resolve-root"
import { App } from "./workbench/App"

// Ctrl+C belongs to the editor for copying selected text.
const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  // Preserve Shift+Enter and Ctrl+Shift+Z instead of collapsing them into plain Enter/Ctrl+Z.
  useKittyKeyboard: { allKeysAsEscapes: true, alternateKeys: true, disambiguate: true },
})
await render(() => <App root={resolveRoot(process.argv[2])} />, renderer)
