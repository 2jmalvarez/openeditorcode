import { createSignal } from "solid-js"
import type { Overlay, PendingAction } from "../workbench/types"
import type { TreeItem } from "../explorer/tree"

export function useOverlays() {
  const [overlay, setOverlay] = createSignal<Overlay>()
  const [newFileName, setNewFileName] = createSignal("")
  const [newFileDirectory, setNewFileDirectory] = createSignal("")
  const [confirmChoice, setConfirmChoice] = createSignal(2)
  const [pendingAction, setPendingAction] = createSignal<PendingAction>()
  const [pendingDeletion, setPendingDeletion] = createSignal<TreeItem>()

  function open(next: Exclude<Overlay, "confirm" | undefined>, directory?: string) {
    setOverlay(next)
    if (next === "new-file") {
      setNewFileName("")
      setNewFileDirectory(directory ?? "")
    }
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

  function close() {
    setOverlay(undefined)
    setNewFileName("")
    setNewFileDirectory("")
    setPendingAction(undefined)
    setPendingDeletion(undefined)
    setConfirmChoice(2)
  }

  return { overlay, newFileName, setNewFileName, newFileDirectory, confirmChoice, setConfirmChoice, pendingAction, pendingDeletion, open, requestConfirm, requestDeletion, close }
}
