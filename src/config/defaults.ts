import type { OecConfig } from "./types"

export const DEFAULT_CONFIG: OecConfig = {
  schemaVersion: 3,
  appearance: { theme: "oec-dark", language: "auto" },
  layout: {
    explorerWidth: 40,
    changesWidth: 44,
    minEditorWidth: 60,
    explorerStartup: "visible",
    changesStartup: "auto",
    narrowSidePanels: "single",
    findPanelMaxWidth: 48,
    diffOrientation: "auto",
    diffStackBelow: 120,
  },
  editor: {
    wrap: "none",
    lineNumbers: true,
    syntax: {
      enabled: true,
      styles: {
        default: { foreground: "#d6e5dc" }, keyword: { foreground: "#79c0ff", bold: true }, string: { foreground: "#a5d6a7" },
        comment: { foreground: "#7d8590", italic: true, dim: true }, number: { foreground: "#e3b341" }, tag: { foreground: "#ffab70", bold: true }, property: { foreground: "#d2a8ff" },
      },
    },
    formatting: { formatOnSave: false, defaultFormatter: "prettier", byExtension: { ".js": "prettier", ".jsx": "prettier", ".ts": "prettier", ".tsx": "prettier", ".json": "prettier", ".css": "prettier", ".html": "prettier", ".md": "prettier", ".yml": "prettier", ".yaml": "prettier" }, prettier: { printWidth: 100, tabWidth: 2, useTabs: false, semi: true, singleQuote: false } },
  },
  keyboard: { profile: "default", bindings: {} },
  formatters: { external: {} },
  search: { respectGitignore: true },
  git: { autoRefresh: true, fetchOnRefresh: true },
  updates: { checkOnStartup: true },
  preview: { markdownDefault: "preview", images: true, imageProtocol: "auto" },
}

export function factoryConfig(): OecConfig { return structuredClone(DEFAULT_CONFIG) }

export function serializeConfig(config: OecConfig): string { return `${JSON.stringify(config, null, 2)}\n` }
