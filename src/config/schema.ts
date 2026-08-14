import type { OecConfig } from "./types"
import { t } from "../localization"
import { factoryConfig } from "./defaults"

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T)
}

export function parseConfig(text: string): OecConfig {
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error(t("config.invalidJson")) }
  const root = record(input)
  if (!root) throw new Error(t("config.keys"))
  // Configurations created before language support keep following the system locale.
  const legacyAppearance = record(root.appearance)
  if (legacyAppearance && exactKeys(legacyAppearance, ["theme"])) legacyAppearance.language = "auto"
  if (root.schemaVersion === 1) {
    const legacy = { ...root, schemaVersion: 2, preview: factoryConfig().preview }
    return parseConfig(JSON.stringify(legacy))
  }
  if (!exactKeys(root, ["schemaVersion", "appearance", "layout", "editor", "search", "git", "updates", "preview"])) throw new Error(t("config.keys"))
  if (root.schemaVersion !== 2) throw new Error(t("config.version"))
  const appearance = record(root.appearance)
  const layout = record(root.layout)
  const editor = record(root.editor)
  const search = record(root.search)
  const git = record(root.git)
  const updates = record(root.updates)
  const preview = record(root.preview)
  if (!appearance || !exactKeys(appearance, ["theme", "language"]) || appearance.theme !== "oec-dark" || !oneOf(appearance.language, ["auto", "es", "en"] as const)) throw new Error(t("config.appearance"))
  if (!layout || !exactKeys(layout, ["explorerWidth", "changesWidth", "minEditorWidth", "explorerStartup", "changesStartup", "narrowSidePanels", "findPanelMaxWidth", "diffOrientation", "diffStackBelow"])) throw new Error(t("config.layout"))
  if (!integer(layout.explorerWidth, 24, 80) || !integer(layout.changesWidth, 32, 80) || !integer(layout.minEditorWidth, 32, 160) || !integer(layout.findPanelMaxWidth, 24, 80) || !integer(layout.diffStackBelow, 60, 240) || !oneOf(layout.explorerStartup, ["visible", "hidden"] as const) || !oneOf(layout.changesStartup, ["auto", "visible", "hidden"] as const) || layout.narrowSidePanels !== "single" || !oneOf(layout.diffOrientation, ["auto", "horizontal", "vertical"] as const)) throw new Error(t("config.layoutRange"))
  if (!editor || !exactKeys(editor, ["wrap", "lineNumbers", "syntaxHighlighting"]) || !oneOf(editor.wrap, ["none", "word"] as const) || typeof editor.lineNumbers !== "boolean" || typeof editor.syntaxHighlighting !== "boolean") throw new Error(t("config.editor"))
  if (!search || !exactKeys(search, ["respectGitignore"]) || typeof search.respectGitignore !== "boolean") throw new Error(t("config.search"))
  if (!git || !exactKeys(git, ["autoRefresh", "fetchOnRefresh"]) || typeof git.autoRefresh !== "boolean" || typeof git.fetchOnRefresh !== "boolean") throw new Error(t("config.git"))
  if (!updates || !exactKeys(updates, ["checkOnStartup"]) || typeof updates.checkOnStartup !== "boolean") throw new Error(t("config.updates"))
  if (!preview || !exactKeys(preview, ["markdownDefault", "images", "imageProtocol"]) || !oneOf(preview.markdownDefault, ["preview", "source"] as const) || typeof preview.images !== "boolean" || !oneOf(preview.imageProtocol, ["auto", "kitty", "sixel", "blocks"] as const)) throw new Error("La configuración de preview no es válida.")
  return root as OecConfig
}
