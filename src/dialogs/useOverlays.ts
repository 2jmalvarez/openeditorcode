import { createSignal } from "solid-js"
import type { Overlay, PendingAction } from "../workbench/types"
import type { TreeItem } from "../explorer/tree"
import type { GitFile } from "../git/status"

export function useOverlays() {
  const [overlay, setOverlay] = createSignal<Overlay>()
  const [newFileName, setNewFileName] = createSignal("")
  const [newFileDirectory, setNewFileDirectory] = createSignal("")
  const [confirmChoice, setConfirmChoice] = createSignal(2)
  const [pendingAction, setPendingAction] = createSignal<PendingAction>()
  const [pendingDeletion, setPendingDeletion] = createSignal<TreeItem>()
  const [pendingGitRevert, setPendingGitRevert] = createSignal<GitFile[]>([])
  const [pendingExternalChange, setPendingExternalChange] = createSignal<string>()
  const [settingsIndex, setSettingsIndex] = createSignal(0)
  const [settingsScope, setSettingsScope] = createSignal<"global" | "project">("global")

  function open(next: Exclude<Overlay, "confirm" | undefined>, directory?: string) {
    setOverlay(next)
    if (next === "new-file") {
      setNewFileName("")
      setNewFileDirectory(directory ?? "")
    }
    if (next === "settings") setSettingsIndex(0)
  }

  function requestConfirm(action: PendingAction) {
    setPendingAction(action)
    setConfirmChoice(2)
    setOverlay("confirm")
  }

  function requestDeletion(item: TreeItem) {
    setPendingDeletion(item)
    setOverlay("delete-confirm")
  }

  function requestGitRevert(files: GitFile[]) {
    setPendingGitRevert(files)
    setOverlay("git-revert-confirm")
  }

  function requestExternalChange(path: string) {
    setPendingExternalChange(path)
    setConfirmChoice(2)
    setOverlay("external-change-confirm")
  }

  function close() {
    setOverlay(undefined)
    setNewFileName("")
    setNewFileDirectory("")
    setPendingAction(undefined)
    setPendingDeletion(undefined)
    setPendingGitRevert([])
    setPendingExternalChange(undefined)
    setConfirmChoice(2)
  }

  return { overlay, newFileName, setNewFileName, newFileDirectory, confirmChoice, setConfirmChoice, pendingAction, pendingDeletion, pendingGitRevert, pendingExternalChange, settingsIndex, setSettingsIndex, settingsScope, setSettingsScope, open, requestConfirm, requestDeletion, requestGitRevert, requestExternalChange, close }
}
