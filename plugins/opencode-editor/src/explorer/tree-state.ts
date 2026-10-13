import { dirname } from "node:path"
import { createTree, type TreeItem } from "../../../../src/explorer/tree"
import { ensurePhysicallyInsideRoot } from "../../../../src/documents/files"

export class TreeState {
  items: TreeItem[] = []
  selected = 0
  scrollTop = 0
  private expanded = new Set<string>()
  private generation = 0
  private disposed = false
  private listeners = new Set<() => void>()
  constructor(readonly root: string) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  async refresh() {
    const generation = ++this.generation
    const selectedPath = this.items[this.selected]?.path
    await ensurePhysicallyInsideRoot(this.root, this.root)
    for (const path of this.expanded) await ensurePhysicallyInsideRoot(this.root, path)
    const items = await createTree(this.root, this.expanded)
    if (this.disposed || generation !== this.generation) return
    this.items = items
    const index = items.findIndex((item) => item.path === selectedPath)
    this.selected = index >= 0 ? index : Math.max(0, Math.min(this.selected, items.length - 1))
    this.changed()
  }
  select(index: number) { this.selected = Math.max(0, Math.min(index, this.items.length - 1)); this.changed() }
  move(direction: number) { this.select(this.selected + direction) }
  async toggle(index = this.selected) {
    const item = this.items[index]
    if (!item?.directory) return
    await ensurePhysicallyInsideRoot(this.root, item.path)
    if (this.expanded.has(item.path)) this.expanded.delete(item.path)
    else this.expanded.add(item.path)
    await this.refresh()
  }
  async collapse() {
    const item = this.items[this.selected]
    if (!item) return
    if (item.directory && this.expanded.has(item.path)) { await this.toggle(); return }
    const index = this.items.findIndex((entry) => entry.path === dirname(item.path))
    if (index >= 0) this.select(index)
  }
  dispose() { this.disposed = true; this.generation++; this.listeners.clear() }
}
