import { basename, dirname } from "node:path"
import type { TreeItem } from "./tree"

/** Build just the matching files and their ancestors, independently of the normal expansion. */
export function filteredTree(root: string, files: readonly { path: string }[], collapsed: ReadonlySet<string> = new Set()): TreeItem[] {
  const children = new Map<string, Map<string, boolean>>()
  for (const file of files) {
    let path = file.path
    let directory = false
    while (path !== root) {
      const parent = dirname(path)
      if (parent === path) break
      const siblings = children.get(parent) ?? new Map<string, boolean>()
      siblings.set(path, directory)
      children.set(parent, siblings)
      path = parent
      directory = true
    }
  }
  const rows: TreeItem[] = []
  function visit(parent: string, depth: number) {
    const entries = [...(children.get(parent) ?? [])].sort(([a, ad], [b, bd]) => Number(bd) - Number(ad) || basename(a).localeCompare(basename(b)))
    for (const [path, directory] of entries) {
      const expanded = directory && !collapsed.has(path)
      rows.push({ path, name: basename(path), directory, depth, expanded, ignored: false })
      if (expanded) visit(path, depth + 1)
    }
  }
  visit(root, 0)
  return rows
}
