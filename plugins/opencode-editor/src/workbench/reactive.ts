import { createSignal, onCleanup } from "solid-js"

export function useRevision(source: { subscribe: (listener: () => void) => () => void }) {
  const [revision, setRevision] = createSignal(0)
  onCleanup(source.subscribe(() => setRevision((value) => value + 1)))
  return revision
}
