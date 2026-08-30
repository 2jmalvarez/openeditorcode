import { useKeyboard } from "@opentui/solid"
import type { KeyEvent } from "@opentui/core"
import { isControlPressed, isShiftPressed } from "../editor/keyboard"
import type { FocusTarget, Overlay } from "./types"
import { matchesCommand } from "./keybindings"

type Props = {
  active: () => FocusTarget
  overlay: () => Overlay
  setConfirmChoice: (value: number | ((value: number) => number)) => void
  searchIndex: () => number
  setSearchIndex: (value: number | ((value: number) => number)) => void
  closeOverlay: () => void
  cancelProjectSearch: () => void
  acceptConfirm: () => Promise<void>
  acceptDeletion: () => Promise<void>
  acceptGitRevert: () => Promise<void>
  acceptExternalChange: () => Promise<void>
  quit: () => void
  refreshActivePanel: () => Promise<void>
  save: () => Promise<boolean>
  undo: () => void
  redo: () => void
  openPalette: () => void
  openLogs: () => void
  openNewFile: () => void
  openProjectSearch: () => void
  openTextSearch: () => void
  editorFindOpen: () => boolean
  moveEditorFindResult: (direction: number) => void
  acceptEditorFind: () => void
  closeEditorFind: () => void
  focusLeft: () => void
  focusRight: () => void
  toggleExplorer: () => void
  toggleGit: () => void
  changeTab: () => void
  cycleFocus: () => void
  toggleWrap: () => void
  togglePreview: () => void
  requestClose: () => void
  copy: () => void
  paste: () => Promise<void>
  paletteLength: () => number
  acceptCommand: () => void
  createNewFile: () => Promise<void>
  projectResultsLength: () => number
  openProjectResult: () => Promise<void>
  findInProject: () => Promise<void>
  collapseAllFolders: () => Promise<void>
  collapseSelectedFolder: () => Promise<void>
  moveExplorerSelection: (direction: number) => void
  activateExplorerItem: () => Promise<void>
  collapseExplorerItem: () => Promise<void>
  requestDeletion: () => void
  moveGitSelection: (direction: number) => void
  activateGitItem: () => Promise<void>
  collapseGitItem: () => void
  collapseAllGitFolders: () => void
  stageGitItem: () => Promise<void>
  unstageGitItem: () => Promise<void>
  requestGitRevert: () => void
  pullGitChanges: () => Promise<void>
  pushGitChanges: () => Promise<void>
  gitCommitFocused: () => boolean
  openFileSearch: () => void
  fileSearchOpen: () => boolean
  closeFileSearch: () => void
  moveFileSearchSelection: (direction: number) => void
  fileSearchResultsLength: () => number
  openFileSearchResult: () => Promise<void>
  openSearchExclusions: () => void
  closeSearchExclusions: () => void
  exclusionSuggestionsLength: () => number
  exclusionIndex: () => number
  setExclusionIndex: (value: number | ((value: number) => number)) => void
  completeExclusion: () => void
  toggleExclusion: () => Promise<void>
  removeExclusion: () => Promise<void>
  bindings: () => Record<string, string[]>
  formatDocument: () => Promise<boolean>
  handleVimKey: (key: KeyEvent) => boolean
  settingsIndex: () => number
  setSettingsIndex: (value: number | ((value: number) => number)) => void
  settingsScope: () => "global" | "project"
  setSettingsScope: (value: "global" | "project") => void
  toggleSetting: () => Promise<void>
  openSettingsJson: () => void
}

export function useKeyboardShortcuts(props: Props) {
  function consume<T>(key: KeyEvent, action: () => T): T {
    key.preventDefault()
    key.stopPropagation()
    return action()
  }

  useKeyboard((key) => {
    const keyName = key.name.toLocaleLowerCase()
    const isEnter = keyName === "return" || keyName === "enter"
    const isEscape = keyName === "escape" || keyName === "esc"
    const shift = key.shift || isShiftPressed()
    const ctrl = key.ctrl || isControlPressed()
    const matches = (command: string, fallback: string) => matchesCommand(key, props.bindings(), command, fallback, ctrl)
    if (props.overlay() === "confirm") {
      if (key.name === "up") return consume(key, () => props.setConfirmChoice((value) => Math.max(0, value - 1)))
      if (key.name === "down") return consume(key, () => props.setConfirmChoice((value) => Math.min(2, value + 1)))
      if (isEnter) return consume(key, () => void props.acceptConfirm())
      if (isEscape) return consume(key, props.closeOverlay)
      return consume(key, () => undefined)
    }
    if (props.overlay() === "delete-confirm") {
      if (isEnter) return consume(key, () => void props.acceptDeletion())
      if (isEscape) return consume(key, props.closeOverlay)
      return consume(key, () => undefined)
    }
    if (props.overlay() === "git-revert-confirm") {
      if (isEnter) return consume(key, () => void props.acceptGitRevert())
      if (isEscape) return consume(key, props.closeOverlay)
      return consume(key, () => undefined)
    }
    if (props.overlay() === "external-change-confirm") {
      if (key.name === "up") return consume(key, () => props.setConfirmChoice((value) => Math.max(0, value - 1)))
      if (key.name === "down") return consume(key, () => props.setConfirmChoice((value) => Math.min(2, value + 1)))
      if (isEnter) return consume(key, () => void props.acceptExternalChange())
      if (isEscape) return consume(key, props.closeOverlay)
      return consume(key, () => undefined)
    }
    if (props.overlay() === "settings") {
      if (isEscape) return consume(key, props.closeOverlay)
      if (key.name === "down") return consume(key, () => props.setSettingsIndex((value) => Math.min(4, value + 1)))
      if (key.name === "up") return consume(key, () => props.setSettingsIndex((value) => Math.max(0, value - 1)))
      if (key.name === "left") return consume(key, () => props.setSettingsScope("global"))
      if (key.name === "right") return consume(key, () => props.setSettingsScope("project"))
      if (keyName === "e") return consume(key, props.openSettingsJson)
      if (isEnter) return consume(key, () => void props.toggleSetting())
      return consume(key, () => undefined)
    }
    if (props.overlay() === "search-exclusions") {
      if (isEscape) return consume(key, props.closeSearchExclusions)
      if (key.name === "tab") return consume(key, props.completeExclusion)
      if (key.name === "down") return consume(key, () => props.setExclusionIndex((value) => Math.min(value + 1, Math.max(0, props.exclusionSuggestionsLength() - 1))))
      if (key.name === "up") return consume(key, () => props.setExclusionIndex((value) => Math.max(0, value - 1)))
      if (keyName === "delete") return consume(key, () => void props.removeExclusion())
      if (isEnter) return consume(key, () => void props.toggleExclusion())
      return
    }
    if (props.overlay() === "command-palette") {
      if (isEscape) return consume(key, props.closeOverlay)
      if (key.name === "down") return consume(key, () => props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.paletteLength() - 1))))
      if (key.name === "up") return consume(key, () => props.setSearchIndex((value) => Math.max(0, value - 1)))
      if (isEnter) return consume(key, props.acceptCommand)
      return
    }
    if (props.overlay() === "new-file") {
      if (isEscape) return consume(key, props.closeOverlay)
      if (isEnter) return consume(key, () => void props.createNewFile())
      return
    }
    if (props.overlay() === "project-search") {
      if (ctrl && keyName === "e") return consume(key, props.openSearchExclusions)
      if (isEscape) return consume(key, props.cancelProjectSearch)
      if (key.name === "down") return consume(key, () => props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.projectResultsLength() - 1))))
      if (key.name === "up") return consume(key, () => props.setSearchIndex((value) => Math.max(0, value - 1)))
      if (isEnter) return consume(key, () => void (props.projectResultsLength() ? props.openProjectResult() : props.findInProject()))
      return
    }
    if (props.fileSearchOpen()) {
      if (keyName === "f5") return consume(key, () => void props.refreshActivePanel())
      if (ctrl && keyName === "e") return consume(key, props.openSearchExclusions)
      if (isEscape) return consume(key, props.closeFileSearch)
      if (key.name === "down") return consume(key, () => props.moveFileSearchSelection(1))
      if (key.name === "up") return consume(key, () => props.moveFileSearchSelection(-1))
      if (isEnter && props.fileSearchResultsLength()) return consume(key, () => void props.openFileSearchResult())
      return
    }
    if (matches("app.quit", "ctrl+q")) return consume(key, props.quit)
    if (matches("app.logs", "f12")) return consume(key, props.openLogs)
    if (matches("panel.refresh", "f5")) return consume(key, () => void props.refreshActivePanel())
    if (matches("file.save", "ctrl+s")) return consume(key, () => void props.save())
    if (props.active() === "editor" && matches("editor.redo", "ctrl+shift+z")) return consume(key, props.redo)
    if (props.active() === "editor" && matches("editor.undo", "ctrl+z")) return consume(key, props.undo)
    if (matches("palette.open", "ctrl+p")) return consume(key, props.openPalette)
    if (matches("file.new", "ctrl+n")) return consume(key, props.openNewFile)
    if (matches("search.project", "ctrl+alt+f")) return consume(key, props.openProjectSearch)
    if (matches("search.local", "ctrl+f")) return consume(key, props.active() === "explorer" ? props.openFileSearch : props.openTextSearch)
    if (matches("navigation.focusLeft", "ctrl+shift+left")) return consume(key, props.focusLeft)
    if (matches("navigation.focusRight", "ctrl+shift+right")) return consume(key, props.focusRight)
    if (matches("panel.toggleGit", "ctrl+alt+b")) return consume(key, props.toggleGit)
    if (matches("editor.preview", "f4")) return consume(key, props.togglePreview)
    if (matches("panel.toggleExplorer", "ctrl+b")) return consume(key, props.toggleExplorer)
    if (matches("file.nextTab", "shift+tab")) return consume(key, props.changeTab)
    if (matches("editor.toggleWrap", "ctrl+l")) return consume(key, props.toggleWrap)
    if (matches("file.close", "ctrl+w")) return consume(key, props.requestClose)
    if (matches("editor.formatDocument", "alt+shift+f")) return consume(key, () => void props.formatDocument())
    if (props.active() === "editor" && matches("editor.copy", "ctrl+c")) return consume(key, props.copy)
    if (matches("editor.paste", "ctrl+v")) return consume(key, () => void props.paste())
    if (isEscape && props.editorFindOpen()) return consume(key, props.closeEditorFind)
    if (props.editorFindOpen()) {
      if (key.name === "down") return consume(key, () => props.moveEditorFindResult(1))
      if (key.name === "up") return consume(key, () => props.moveEditorFindResult(-1))
      if (isEnter) return consume(key, props.acceptEditorFind)
      return
    }
    if (props.handleVimKey(key)) return consume(key, () => undefined)
    if (key.name === "tab") return consume(key, props.cycleFocus)
    if (props.active() === "git") {
      if (keyName === "f6") return consume(key, () => void props.pullGitChanges())
      if (keyName === "f7") return consume(key, () => void props.pushGitChanges())
      if (props.gitCommitFocused()) {
        if (key.name === "up") return consume(key, () => props.moveGitSelection(-1))
        if (isEnter) return consume(key, () => void props.activateGitItem())
        return
      }
      if (ctrl && shift && isEnter) return consume(key, props.collapseAllGitFolders)
      if (shift && isEnter) return consume(key, props.collapseGitItem)
      if (key.name === "down") return consume(key, () => props.moveGitSelection(1))
      if (key.name === "up") return consume(key, () => props.moveGitSelection(-1))
      if (isEnter) return consume(key, () => void props.activateGitItem())
      if (keyName === "+") return consume(key, () => void props.stageGitItem())
      if (keyName === "-") return consume(key, props.requestGitRevert)
      return
    }
    if (props.active() !== "explorer") return
    if (ctrl && shift && isEnter) return consume(key, () => void props.collapseAllFolders())
    if (shift && isEnter) return consume(key, () => void props.collapseSelectedFolder())
    if (key.name === "down") return consume(key, () => props.moveExplorerSelection(1))
    if (key.name === "up") return consume(key, () => props.moveExplorerSelection(-1))
    if (isEnter) return consume(key, () => void props.activateExplorerItem())
    if (key.name === "left") return consume(key, () => void props.collapseExplorerItem())
    if (keyName === "delete") return consume(key, props.requestDeletion)
  })
}
