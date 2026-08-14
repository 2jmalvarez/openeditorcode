/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { writeFileSync } from "node:fs"
import { resolveRoot } from "./bootstrap/resolve-root"
import { App } from "./workbench/App"
import { clearRecoveryNotice, loadConfig, markConfigHealthy } from "./config/storage"
import { parseCli } from "./bootstrap/cli"
import { configureLanguage } from "./localization"

configureLanguage("auto")
const loadedConfig = await loadConfig()
configureLanguage(loadedConfig.config.appearance.language)
const cli = parseCli(process.argv.slice(2))
if ("output" in cli) {
  console.log(cli.output)
  process.exitCode = cli.exitCode
} else {
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
  if (process.env.OEC_CONFIG_ATTEMPT_ID) renderer.once("frame", () => {
    void markConfigHealthy(loadedConfig.paths, process.env.OEC_CONFIG_ATTEMPT_ID!)
    void clearRecoveryNotice(loadedConfig.paths)
  })
  await render(() => <App root={resolveRoot(cli.project)} config={loadedConfig.config} configPaths={loadedConfig.paths} recovery={loadedConfig.recovery} />, renderer)
}
