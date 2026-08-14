import { DEFAULT_CONFIG } from "../config/defaults"
import type { OecConfig } from "../config/types"

export const EXPLORER_WIDTH = DEFAULT_CONFIG.layout.explorerWidth
export const GIT_WIDTH = DEFAULT_CONFIG.layout.changesWidth
export const MIN_EDITOR_WIDTH = DEFAULT_CONFIG.layout.minEditorWidth

export function canShowBothSidePanels(width: number, layout = DEFAULT_CONFIG.layout): boolean {
  return width >= layout.explorerWidth + layout.changesWidth + layout.minEditorWidth
}

export function editorWidth(width: number, explorerVisible: boolean, gitVisible: boolean, layout = DEFAULT_CONFIG.layout): number {
  return width - (explorerVisible ? layout.explorerWidth : 0) - (gitVisible ? layout.changesWidth : 0)
}

export function initialSidePanels(width: number, config: OecConfig) {
  const explorer = config.layout.explorerStartup === "visible"
  const changes = config.layout.changesStartup === "visible" || (config.layout.changesStartup === "auto" && canShowBothSidePanels(width, config.layout))
  return { explorer, changes: changes && (explorer ? canShowBothSidePanels(width, config.layout) : true) }
}
