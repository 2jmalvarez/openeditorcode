import { ensurePhysicallyInsideRoot } from "../../../../src/documents/files"
import { buildFileIndex, filterItems, type IndexedItem } from "../../../../src/search/file-index"
import { basename, dirname, join, relative, sep } from "node:path"
import type { TreeItem } from "../../../../src/explorer/tree"

/** Ancestors are context, not extra search hits; siblings keep normal tree order. */
export function resultTree(root: string, matches: IndexedItem[], collapsed: ReadonlySet<string> = new Set()): TreeItem[] {
  const children = new Map<string, Map<string, TreeItem>>()
  for (const match of matches) {
    const parts = relative(root, match.path).split(sep)
    let parent = root
    parts.forEach((part, depth) => {
      const path = join(parent, part)
      const directory = depth < parts.length - 1
      const siblings = children.get(parent) ?? new Map<string, TreeItem>()
      siblings.set(path, { path, name: basename(path), depth, directory, expanded: directory && !collapsed.has(path), ignored: false })
      children.set(parent, siblings)
      parent = path
    })
  }
  const rows: TreeItem[] = []
  const visit = (parent: string) => {
    const siblings = [...(children.get(parent)?.values() ?? [])].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
    for (const item of siblings) { rows.push(item); if (item.expanded) visit(item.path) }
  }
  visit(root)
  return rows
}

/** A bounded, lazy index independent of which tree folders are expanded. */
export class FileSearch {
  query = ""
  items: IndexedItem[] = []
  rows: TreeItem[] = []
  selected = 0
  scrollTop = 0
  loading = false
  truncated = false
  error = ""
  private index: IndexedItem[] | undefined
  private pending: Promise<void> | undefined
  private disposed = false
  private listeners = new Set<() => void>()
  private collapsed = new Set<string>()
  constructor(readonly root: string) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  private filter(reset = true) {
    const selectedPath = reset ? undefined : this.rows[this.selected]?.path
    this.items = this.query.trim() ? filterItems(this.root, this.index ?? [], this.query.trim().replace(/[\\/]/g, sep), 80) : []
    if (reset) this.collapsed.clear()
    this.rows = resultTree(this.root, this.items, this.collapsed)
    const retained = this.rows.findIndex((row) => row.path === selectedPath)
    this.selected = retained >= 0 ? retained : Math.max(0, this.rows.findIndex((row) => row.path === this.items[0]?.path))
    if (reset) this.scrollTop = 0
  }
  invalidate() { this.index = undefined }
  async search(query: string) {
    // Remounting an input can emit its existing value; that is not a new query.
    if (query === this.query) { if (!this.index && query.trim()) await this.refresh(); return }
    this.query = query
    this.error = ""
    if (!query.trim()) { this.filter(); this.changed(); return }
    this.filter(); this.changed()
    if (!this.index) await this.refresh()
  }
  async refresh() {
    if (this.disposed) return
    if (this.pending) return this.pending
    this.loading = true; this.error = ""; this.changed()
    this.pending = (async () => {
      try {
        await ensurePhysicallyInsideRoot(this.root, this.root)
        const result = await buildFileIndex(this.root)
        if (this.disposed) return
        this.index = result.items.filter((item) => !item.directory)
        this.truncated = result.truncated
        this.filter(false)
      } catch (error) {
        if (!this.disposed) this.error = error instanceof Error ? error.message : String(error)
      } finally { this.loading = false; this.pending = undefined; this.changed() }
    })()
    return this.pending
  }
  select(index: number) { this.selected = Math.max(0, Math.min(index, this.rows.length - 1)); this.changed() }
  move(direction: number) { this.select(this.selected + direction) }
  toggle(index = this.selected) {
    const item = this.rows[index]
    if (!item?.directory) return
    if (this.collapsed.has(item.path)) this.collapsed.delete(item.path)
    else this.collapsed.add(item.path)
    this.rows = resultTree(this.root, this.items, this.collapsed)
    this.select(this.rows.findIndex((row) => row.path === item.path))
  }
  collapse() {
    const item = this.rows[this.selected]
    if (!item) return
    if (item.expanded) { this.toggle(); return }
    const index = this.rows.findIndex((row) => row.path === dirname(item.path))
    if (index >= 0) this.select(index)
  }
  dispose() { this.disposed = true; this.listeners.clear() }
}
