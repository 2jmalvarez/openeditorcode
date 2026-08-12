import { useKeyboard } from "@opentui/solid"
import type { KeyEvent } from "@opentui/core"
import { isControlPressed, isShiftPressed } from "../editor/keyboard"
import type { FocusTarget, Overlay } from "./types"

type Props = {
  active: () => FocusTarget
  setActive: (value: FocusTarget | ((value: FocusTarget) => FocusTarget)) => void
  overlay: () => Overlay
  pendingDeletion: () => unknown
  setConfirmChoice: (value: number | ((value: number) => number)) => void
  searchIndex: () => number
  setSearchIndex: (value: number | ((value: number) => number)) => void
  closeOverlay: () => void
  cancelProjectSearch: () => void
  acceptConfirm: () => Promise<void>
  acceptDeletion: () => Promise<void>
  quit: () => void
  refreshExplorer: () => Promise<void>
  save: () => Promise<boolean>
  undo: () => void
  redo: () => void
  openPalette: () => void
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
    const shift = key.shift || isShiftPressed()
    const ctrl = key.ctrl || isControlPressed()
    if (props.overlay() === "confirm") {
      if (key.name === "up") return consume(key, () => props.setConfirmChoice((value) => Math.max(0, value - 1)))
      if (key.name === "down") return consume(key, () => props.setConfirmChoice((value) => Math.min(2, value + 1)))
      if (isEnter) return consume(key, () => void props.acceptConfirm())
      if (key.name === "escape") return consume(key, props.closeOverlay)
      return
    }
    if (props.overlay() === "delete-confirm") {
      if (isEnter) return consume(key, () => void props.acceptDeletion())
      if (key.name === "escape") return consume(key, props.closeOverlay)
      return
    }
    if (ctrl && keyName === "q") return consume(key, props.quit)
    if (keyName === "f5") return consume(key, () => void props.refreshExplorer())
    if (ctrl && keyName === "s") return consume(key, () => void props.save())
    if (ctrl && shift && keyName === "z") return consume(key, props.redo)
    if (ctrl && keyName === "z") return consume(key, props.undo)
    if (ctrl && keyName === "p") return consume(key, props.openPalette)
    if (ctrl && keyName === "n") return consume(key, props.openNewFile)
    if (ctrl && (key.option || key.meta) && keyName === "f") return consume(key, props.openProjectSearch)
    if (ctrl && keyName === "f") return consume(key, props.openTextSearch)
    if (ctrl && shift && keyName === "left") return consume(key, props.focusLeft)
    if (ctrl && shift && keyName === "right") return consume(key, props.focusRight)
    if (ctrl && (key.option || key.meta) && keyName === "b") return consume(key, props.toggleGit)
    if (ctrl && keyName === "b") return consume(key, props.toggleExplorer)
    if (shift && keyName === "tab") return consume(key, props.changeTab)
    if (ctrl && ((key.option || key.meta) && keyName === "w" || keyName === "l")) return consume(key, props.toggleWrap)
    if (ctrl && keyName === "w") return consume(key, props.requestClose)
    if (ctrl && keyName === "c") return consume(key, props.copy)
    if (ctrl && keyName === "v") return consume(key, () => void props.paste())
    if (key.name === "escape" && props.editorFindOpen()) return consume(key, props.closeEditorFind)
    if (props.editorFindOpen()) {
      if (key.name === "down") return consume(key, () => props.moveEditorFindResult(1))
      if (key.name === "up") return consume(key, () => props.moveEditorFindResult(-1))
      if (isEnter) return consume(key, props.acceptEditorFind)
      return
    }
    if (key.name === "escape" && props.overlay() === "project-search") return consume(key, props.cancelProjectSearch)
    if (key.name === "escape" && props.overlay()) return consume(key, props.closeOverlay)
    if (props.overlay() === "command-palette") {
      if (key.name === "down") return consume(key, () => props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.paletteLength() - 1))))
      if (key.name === "up") return consume(key, () => props.setSearchIndex((value) => Math.max(0, value - 1)))
      if (isEnter) return consume(key, props.acceptCommand)
      return
    }
    if (props.overlay() === "new-file" && isEnter) return consume(key, () => void props.createNewFile())
    if (props.overlay() === "project-search") {
      if (key.name === "down") return consume(key, () => props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.projectResultsLength() - 1))))
      if (key.name === "up") return consume(key, () => props.setSearchIndex((value) => Math.max(0, value - 1)))
      if (isEnter) return consume(key, () => void (props.projectResultsLength() ? props.openProjectResult() : props.findInProject()))
      return
    }
    if (key.name === "tab") return consume(key, props.cycleFocus)
    if (props.active() === "git") {
      if (ctrl && shift && isEnter) return consume(key, props.collapseAllGitFolders)
      if (shift && isEnter) return consume(key, props.collapseGitItem)
      if (key.name === "down") return consume(key, () => props.moveGitSelection(1))
      if (key.name === "up") return consume(key, () => props.moveGitSelection(-1))
      if (isEnter) return consume(key, () => void props.activateGitItem())
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
