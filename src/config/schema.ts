import type { ExternalFormatter, OecConfig, PrettierOptions, ProjectConfig, SyntaxToken, SyntaxTokenStyle } from "./types"
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

const syntaxTokens = ["default", "keyword", "string", "comment", "number", "tag", "property"] as const satisfies readonly SyntaxToken[]

function color(value: unknown): value is string { return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) }
function syntaxToken(value: unknown): value is SyntaxTokenStyle {
  const item = record(value)
  return Boolean(item && Object.keys(item).every((key) => ["foreground", "bold", "italic", "dim"].includes(key)) && color(item.foreground) && (item.bold === undefined || typeof item.bold === "boolean") && (item.italic === undefined || typeof item.italic === "boolean") && (item.dim === undefined || typeof item.dim === "boolean"))
}
function prettierOptions(value: unknown): value is PrettierOptions {
  const item = record(value)
  return Boolean(item && exactKeys(item, ["printWidth", "tabWidth", "useTabs", "semi", "singleQuote"]) && integer(item.printWidth, 40, 240) && integer(item.tabWidth, 1, 16) && typeof item.useTabs === "boolean" && typeof item.semi === "boolean" && typeof item.singleQuote === "boolean")
}
function externalFormatter(value: unknown): value is ExternalFormatter {
  const item = record(value)
  return Boolean(item && exactKeys(item, ["command", "args", "extensions", "timeoutMs"]) && typeof item.command === "string" && item.command.length > 0 && Array.isArray(item.args) && item.args.every((entry) => typeof entry === "string") && Array.isArray(item.extensions) && item.extensions.every((entry) => typeof entry === "string" && entry.startsWith(".")) && integer(item.timeoutMs, 100, 120_000))
}

function rejectUnknown(value: unknown, template: unknown): void {
  const source = record(value)
  const allowed = record(template)
  if (!source || !allowed) return
  for (const [key, nested] of Object.entries(source)) {
    if (!(key in allowed)) throw new Error(t("config.keys"))
    if (record(nested) && record(allowed[key])) rejectUnknown(nested, allowed[key])
  }
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
  if (root.schemaVersion === 2) {
    const legacyEditor = record(root.editor)
    const migrated = { ...root, schemaVersion: 3, editor: { ...legacyEditor, syntax: { enabled: legacyEditor?.syntaxHighlighting ?? true, styles: factoryConfig().editor.syntax.styles }, formatting: factoryConfig().editor.formatting }, keyboard: factoryConfig().keyboard, formatters: factoryConfig().formatters }
    delete (migrated.editor as Record<string, unknown>).syntaxHighlighting
    return parseConfig(JSON.stringify(migrated))
  }
  if (!exactKeys(root, ["schemaVersion", "appearance", "layout", "editor", "keyboard", "formatters", "search", "git", "updates", "preview"])) throw new Error(t("config.keys"))
  if (root.schemaVersion !== 3) throw new Error(t("config.version"))
  const appearance = record(root.appearance)
  const layout = record(root.layout)
  const editor = record(root.editor)
  const keyboard = record(root.keyboard)
  const formatters = record(root.formatters)
  const search = record(root.search)
  const git = record(root.git)
  const updates = record(root.updates)
  const preview = record(root.preview)
  if (!appearance || !exactKeys(appearance, ["theme", "language"]) || appearance.theme !== "oec-dark" || !oneOf(appearance.language, ["auto", "es", "en"] as const)) throw new Error(t("config.appearance"))
  if (!layout || !exactKeys(layout, ["explorerWidth", "changesWidth", "minEditorWidth", "explorerStartup", "changesStartup", "narrowSidePanels", "findPanelMaxWidth", "diffOrientation", "diffStackBelow"])) throw new Error(t("config.layout"))
  if (!integer(layout.explorerWidth, 24, 80) || !integer(layout.changesWidth, 32, 80) || !integer(layout.minEditorWidth, 32, 160) || !integer(layout.findPanelMaxWidth, 24, 80) || !integer(layout.diffStackBelow, 60, 240) || !oneOf(layout.explorerStartup, ["visible", "hidden"] as const) || !oneOf(layout.changesStartup, ["auto", "visible", "hidden"] as const) || layout.narrowSidePanels !== "single" || !oneOf(layout.diffOrientation, ["auto", "horizontal", "vertical"] as const)) throw new Error(t("config.layoutRange"))
  if (!editor || !exactKeys(editor, ["wrap", "lineNumbers", "syntax", "formatting"]) || !oneOf(editor.wrap, ["none", "word"] as const) || typeof editor.lineNumbers !== "boolean") throw new Error(t("config.editor"))
  const syntax = record(editor.syntax)
  const formatting = record(editor.formatting)
  const styles = syntax && record(syntax.styles)
  const extensions = formatting && record(formatting.byExtension)
  const bindings = keyboard && record(keyboard.bindings)
  const external = formatters && record(formatters.external)
  if (!syntax || !styles || !exactKeys(syntax, ["enabled", "styles"]) || typeof syntax.enabled !== "boolean" || !exactKeys(styles, [...syntaxTokens]) || !syntaxTokens.every((token) => syntaxToken(styles[token]))) throw new Error(t("config.editor"))
  if (!formatting || !extensions || !exactKeys(formatting, ["formatOnSave", "defaultFormatter", "byExtension", "prettier"]) || typeof formatting.formatOnSave !== "boolean" || !oneOf(formatting.defaultFormatter, ["prettier", "none"] as const) || !Object.entries(extensions).every(([extension, formatter]) => extension.startsWith(".") && typeof formatter === "string") || !prettierOptions(formatting.prettier)) throw new Error(t("config.editor"))
  if (!keyboard || !bindings || !exactKeys(keyboard, ["profile", "bindings"]) || !oneOf(keyboard.profile, ["default", "vim"] as const) || !Object.values(bindings).every((value) => Array.isArray(value) && value.every((binding) => typeof binding === "string" && binding.length > 0))) throw new Error(t("config.editor"))
  if (!formatters || !external || !exactKeys(formatters, ["external"]) || !Object.values(external).every(externalFormatter)) throw new Error(t("config.editor"))
  if (!search || !exactKeys(search, ["respectGitignore"]) || typeof search.respectGitignore !== "boolean") throw new Error(t("config.search"))
  if (!git || !exactKeys(git, ["autoRefresh", "fetchOnRefresh"]) || typeof git.autoRefresh !== "boolean" || typeof git.fetchOnRefresh !== "boolean") throw new Error(t("config.git"))
  if (!updates || !exactKeys(updates, ["checkOnStartup"]) || typeof updates.checkOnStartup !== "boolean") throw new Error(t("config.updates"))
  if (!preview || !exactKeys(preview, ["markdownDefault", "images", "imageProtocol"]) || !oneOf(preview.markdownDefault, ["preview", "source"] as const) || typeof preview.images !== "boolean" || !oneOf(preview.imageProtocol, ["auto", "kitty", "sixel", "blocks"] as const)) throw new Error("La configuración de preview no es válida.")
  return root as OecConfig
}

function merge<T>(base: T, override: unknown): T {
  const baseRecord = record(base)
  const overrideRecord = record(override)
  if (!baseRecord || !overrideRecord) return override === undefined ? base : override as T
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(overrideRecord)) result[key] = key in result ? merge(result[key], value) : value
  return result as T
}

export function parseProjectConfig(text: string): ProjectConfig {
  let input: unknown
  try { input = JSON.parse(text) } catch { throw new Error(t("config.invalidJson")) }
  const root = record(input)
  if (!root || root.schemaVersion !== 3) throw new Error(t("config.version"))
  const { formatters: _formatters, ...permitted } = factoryConfig()
  rejectUnknown(root, permitted)
  const merged = merge(factoryConfig(), root)
  parseConfig(JSON.stringify(merged))
  return root as ProjectConfig
}

export function resolveConfig(global: OecConfig, project?: ProjectConfig): OecConfig { return project ? merge(global, project) : global }
