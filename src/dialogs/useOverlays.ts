import { createSignal } from "solid-js"
import type { Overlay, PendingAction } from "../workbench/types"

export function useOverlays() {
  const [overlay, setOverlay] = createSignal<Overlay>()
  const [newFileName, setNewFileName] = createSignal("")
  const [confirmChoice, setConfirmChoice] = createSignal(1)
  const [pendingAction, setPendingAction] = createSignal<PendingAction>()

  function open(next: Exclude<Overlay, "confirm" | undefined>) {
    setOverlay(next)
    if (next === "new-file") setNewFileName("")
  }

  function requestConfirm(action: PendingAction) {
    setPendingAction(action)
    setConfirmChoice(1)
    setOverlay("confirm")
  }

  function close() {
    setOverlay(undefined)
    setNewFileName("")
    setPendingAction(undefined)
    setConfirmChoice(1)
  }

  return { overlay, newFileName, setNewFileName, confirmChoice, setConfirmChoice, pendingAction, open, requestConfirm, close }
}
