import type { Change } from "./git"

export type ChangeRow = { id: string; name: string; depth: number; directory: boolean; expanded?: boolean; parent?: string; change?: Change }

/** Stable IDs include the area: a staged file may also have working-tree changes. */
export function changeTree(files: readonly Change[], collapsed: ReadonlySet<string> = new Set()): ChangeRow[] {
  const children = new Map<string, Map<string, ChangeRow>>()
  for (const change of files) {
    const parts = change.file.split("/")
    let parent = ""
    parts.forEach((name, depth) => {
      const directory = depth < parts.length - 1
      const path = parts.slice(0, depth + 1).join("/")
      const id = directory ? `dir:${path}` : `${change.area}:${path}`
      const siblings = children.get(parent) ?? new Map<string, ChangeRow>()
      siblings.set(id, { id, name, depth, directory, expanded: directory && !collapsed.has(id), parent: parent || undefined, change: directory ? undefined : change })
      children.set(parent, siblings)
      parent = id
    })
  }
  const rows: ChangeRow[] = []
  const visit = (parent: string) => {
    for (const row of [...(children.get(parent)?.values() ?? [])].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))) {
      rows.push(row)
      if (row.expanded) visit(row.id)
    }
  }
  visit("")
  return rows
}
