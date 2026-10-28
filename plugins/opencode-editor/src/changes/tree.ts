import type { Change, LocalRepository } from "./git"

export type ChangeRow = { id: string; name: string; depth: number; directory: boolean; expanded?: boolean; parent?: string; change?: Change; repository?: LocalRepository; changedFiles?: number; detail?: boolean }

/** Stable IDs include the area: a staged file may also have working-tree changes. */
export function changeTree(files: readonly Change[], collapsed: ReadonlySet<string> = new Set(), repositories: readonly LocalRepository[] = []): ChangeRow[] {
  if (repositories.length) return repositories.flatMap((repository): ChangeRow[] => {
    const id = `repo:${encodeURIComponent(repository.id)}`
    const expanded = !collapsed.has(id)
    const localFiles = files.filter((file) => file.repositoryRoot === repository.root)
    const changedFiles = new Set(localFiles.map((file) => file.file)).size
    const rows: ChangeRow[] = [{ id, name: repository.name, depth: 0, directory: true, expanded, repository, changedFiles }]
    if (!expanded) return rows
    const prefix = `${id}:`
    const localCollapsed = new Set([...collapsed].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)))
    const children = changeTree(localFiles, localCollapsed)
    if (repository.error || !children.length) rows.push({ id: `${id}:status`, name: repository.error || "No changes", depth: 1, directory: false, parent: id, detail: true })
    rows.push(...children.map((row) => ({ ...row, id: prefix + row.id, depth: row.depth + 1, parent: row.parent ? prefix + row.parent : id })))
    return rows
  })
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
