/** @jsxImportSource @opentui/solid */
import { writeFileSync } from "node:fs"
import { resolveRoot } from "./bootstrap/resolve-root"
import { parseCli } from "./bootstrap/cli"
import { configureLanguage } from "./localization"

configureLanguage("auto")
const cli = parseCli(process.argv.slice(2))
if ("output" in cli) {
  console.log(cli.output)
  process.exitCode = cli.exitCode
} else {
  const { clearRecoveryNotice, loadConfig, loadProjectConfig, markConfigHealthy, resolveConfig } = await import("./config/storage")
  const loadedConfig = await loadConfig()
  const root = resolveRoot(cli.project)
  const loadedProject = await loadProjectConfig(root).catch(() => ({ config: undefined, path: "" }))
  const config = resolveConfig(loadedConfig.config, loadedProject.config)
  configureLanguage(config.appearance.language)
  const { createCliRenderer } = await import("@opentui/core")
  const { render } = await import("@opentui/solid")
  const { App } = await import("./workbench/App")
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
  await render(() => <App root={root} config={config} globalConfig={loadedConfig.config} projectConfig={loadedProject.config} configPaths={loadedConfig.paths} projectConfigPath={loadedProject.path} recovery={loadedConfig.recovery} />, renderer)
}
