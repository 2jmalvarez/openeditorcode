import { useKeyboard } from "@opentui/solid"
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
  focusExplorer: () => void
  changeTab: () => void
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
}

export function useKeyboardShortcuts(props: Props) {
  useKeyboard((key) => {
    const keyName = key.name.toLocaleLowerCase()
    const isEnter = keyName === "return" || keyName === "enter"
    const shift = key.shift || isShiftPressed()
    const ctrl = key.ctrl || isControlPressed()
    if (props.overlay() === "confirm") {
      if (key.name === "up") props.setConfirmChoice((value) => Math.max(0, value - 1))
      if (key.name === "down") props.setConfirmChoice((value) => Math.min(2, value + 1))
      if (isEnter) void props.acceptConfirm()
      if (key.name === "escape") props.closeOverlay()
      return
    }
    if (props.overlay() === "delete-confirm") {
      if (isEnter) void props.acceptDeletion()
      if (key.name === "escape") props.closeOverlay()
      return
    }
    if (ctrl && keyName === "q") return props.quit()
    if (keyName === "f5") return void props.refreshExplorer()
    if (ctrl && keyName === "s") return void props.save()
    if (ctrl && shift && keyName === "z") { key.preventDefault(); key.stopPropagation(); return props.redo() }
    if (ctrl && keyName === "z") { key.preventDefault(); key.stopPropagation(); return props.undo() }
    if (ctrl && keyName === "p") return props.openPalette()
    if (ctrl && keyName === "n") return props.openNewFile()
    if (ctrl && (key.option || key.meta) && keyName === "f") return props.openProjectSearch()
    if (ctrl && keyName === "f") return props.openTextSearch()
    if (ctrl && keyName === "b") return props.focusExplorer()
    if (shift && keyName === "tab") return props.changeTab()
    if (ctrl && ((key.option || key.meta) && keyName === "w" || keyName === "l")) return props.toggleWrap()
    if (ctrl && keyName === "w") return props.requestClose()
    if (ctrl && keyName === "c") return props.copy()
    if (ctrl && keyName === "v") return void props.paste()
    if (key.name === "escape" && props.editorFindOpen()) return props.closeEditorFind()
    if (props.editorFindOpen()) {
      if (key.name === "down") { key.preventDefault(); key.stopPropagation(); return props.moveEditorFindResult(1) }
      if (key.name === "up") { key.preventDefault(); key.stopPropagation(); return props.moveEditorFindResult(-1) }
      if (isEnter) { key.preventDefault(); key.stopPropagation(); return props.acceptEditorFind() }
      return
    }
    if (key.name === "escape" && props.overlay()) return props.closeOverlay()
    if (props.overlay() === "command-palette") {
      if (key.name === "down") props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.paletteLength() - 1)))
      if (key.name === "up") props.setSearchIndex((value) => Math.max(0, value - 1))
      if (isEnter) props.acceptCommand()
      return
    }
    if (props.overlay() === "new-file" && isEnter) return void props.createNewFile()
    if (props.overlay() === "project-search") {
      if (key.name === "down") props.setSearchIndex((value) => Math.min(value + 1, Math.max(0, props.projectResultsLength() - 1)))
      if (key.name === "up") props.setSearchIndex((value) => Math.max(0, value - 1))
      if (isEnter) return void (props.projectResultsLength() ? props.openProjectResult() : props.findInProject())
      return
    }
    if (key.name === "tab") return props.setActive((value) => value === "explorer" ? "editor" : "explorer")
    if (props.active() !== "explorer") return
    if (ctrl && shift && isEnter) { key.preventDefault(); key.stopPropagation(); return void props.collapseAllFolders() }
    if (shift && isEnter) { key.preventDefault(); key.stopPropagation(); return void props.collapseSelectedFolder() }
    if (key.name === "down") return props.moveExplorerSelection(1)
    if (key.name === "up") return props.moveExplorerSelection(-1)
    if (isEnter) return void props.activateExplorerItem()
    if (key.name === "left") return void props.collapseExplorerItem()
    if (keyName === "delete") return props.requestDeletion()
  })
}
