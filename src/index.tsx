/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { App, resolveRoot } from "./app"

// Ctrl+C belongs to the editor for copying selected text.
const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  // Preserve Shift+Enter and Ctrl+Shift+Z instead of collapsing them into plain Enter/Ctrl+Z.
  useKittyKeyboard: { allKeysAsEscapes: true, alternateKeys: true, disambiguate: true },
})
await render(() => <App root={resolveRoot(process.argv[2])} />, renderer)
