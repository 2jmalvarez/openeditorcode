import { createSignal } from "solid-js"
import type { Overlay, PendingAction } from "../workbench/types"
import type { TreeItem } from "../explorer/tree"

export function useOverlays() {
  const [overlay, setOverlay] = createSignal<Overlay>()
  const [newFileName, setNewFileName] = createSignal("")
  const [confirmChoice, setConfirmChoice] = createSignal(1)
  const [pendingAction, setPendingAction] = createSignal<PendingAction>()
  const [pendingDeletion, setPendingDeletion] = createSignal<TreeItem>()

  function open(next: Exclude<Overlay, "confirm" | undefined>) {
    setOverlay(next)
    if (next === "new-file") setNewFileName("")
  }

  function requestConfirm(action: PendingAction) {
    setPendingAction(action)
    setConfirmChoice(1)
    setOverlay("confirm")
  }

  function requestDeletion(item: TreeItem) {
    setPendingDeletion(item)
    setOverlay("delete-confirm")
  }

  function close() {
    setOverlay(undefined)
    setNewFileName("")
    setPendingAction(undefined)
    setPendingDeletion(undefined)
    setConfirmChoice(1)
  }

  return { overlay, newFileName, setNewFileName, confirmChoice, setConfirmChoice, pendingAction, pendingDeletion, open, requestConfirm, requestDeletion, close }
}
