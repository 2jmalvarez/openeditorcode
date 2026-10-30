import { createSignal } from "solid-js"
import { changeTree } from "./tree"
import type { Change, LocalRepository } from "./git"

export function createDiffViewState() {
  const [wrap, setWrap] = createSignal(true)
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set())
  return {
    wrap, collapsed, setCollapsed,
    toggleWrap: () => setWrap((value) => !value),
    collapseAll: (files: readonly Change[], repositories: readonly LocalRepository[]) => {
      setCollapsed(new Set(changeTree(files, new Set(), repositories).filter((row) => row.directory).map((row) => row.id)))
    },
  }
}

export type DiffViewState = ReturnType<typeof createDiffViewState>
