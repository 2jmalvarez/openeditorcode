export type OecConfig = {
  schemaVersion: 3
  appearance: { theme: "oec-dark"; language: "auto" | "es" | "en" }
  layout: {
    explorerWidth: number
    changesWidth: number
    minEditorWidth: number
    explorerStartup: "visible" | "hidden"
    changesStartup: "auto" | "visible" | "hidden"
    narrowSidePanels: "single"
    findPanelMaxWidth: number
    diffOrientation: "auto" | "horizontal" | "vertical"
    diffStackBelow: number
  }
  editor: {
    wrap: "none" | "word"
    lineNumbers: boolean
    syntax: {
      enabled: boolean
      styles: Record<SyntaxToken, SyntaxTokenStyle>
    }
    formatting: {
      formatOnSave: boolean
      defaultFormatter: "prettier" | "none"
      byExtension: Record<string, string>
      prettier: PrettierOptions
    }
  }
  keyboard: { profile: "default" | "vim"; bindings: Record<string, string[]> }
  formatters: { external: Record<string, ExternalFormatter> }
  search: { respectGitignore: boolean }
  git: { autoRefresh: boolean; fetchOnRefresh: boolean }
  updates: { checkOnStartup: boolean }
  preview: { markdownDefault: "preview" | "source"; images: boolean; imageProtocol: "auto" | "kitty" | "sixel" | "blocks" }
}

export type SyntaxToken = "default" | "keyword" | "string" | "comment" | "number" | "tag" | "property"
export type SyntaxTokenStyle = { foreground: string; bold?: boolean; italic?: boolean; dim?: boolean }
export type PrettierOptions = { printWidth: number; tabWidth: number; useTabs: boolean; semi: boolean; singleQuote: boolean }
export type ExternalFormatter = { command: string; args: string[]; extensions: string[]; timeoutMs: number }

export type ProjectConfig = { schemaVersion: 3 } & Partial<Omit<OecConfig, "schemaVersion" | "formatters">>

export type ConfigPaths = {
  directory: string
  file: string
  backup: string
  state: string
  notice: string
}

export type ConfigRecovery = { reason: string; backup: string }
