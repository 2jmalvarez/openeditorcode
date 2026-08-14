export type OecConfig = {
  schemaVersion: 2
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
    syntaxHighlighting: boolean
  }
  search: { respectGitignore: boolean }
  git: { autoRefresh: boolean; fetchOnRefresh: boolean }
  updates: { checkOnStartup: boolean }
  preview: { markdownDefault: "preview" | "source"; images: boolean; imageProtocol: "auto" | "kitty" | "sixel" | "blocks" }
}

export type ConfigPaths = {
  directory: string
  file: string
  backup: string
  state: string
  notice: string
}

export type ConfigRecovery = { reason: string; backup: string }
