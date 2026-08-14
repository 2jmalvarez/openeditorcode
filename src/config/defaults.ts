import type { OecConfig } from "./types"

export const DEFAULT_CONFIG: OecConfig = {
  schemaVersion: 2,
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
  editor: { wrap: "none", lineNumbers: true, syntaxHighlighting: true },
  search: { respectGitignore: true },
  git: { autoRefresh: true, fetchOnRefresh: true },
  updates: { checkOnStartup: true },
  preview: { markdownDefault: "preview", images: true, imageProtocol: "auto" },
}

export function factoryConfig(): OecConfig { return structuredClone(DEFAULT_CONFIG) }

export function serializeConfig(config: OecConfig): string { return `${JSON.stringify(config, null, 2)}\n` }
