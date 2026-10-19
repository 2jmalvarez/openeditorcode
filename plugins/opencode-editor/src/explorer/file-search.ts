import { ensurePhysicallyInsideRoot } from "../../../../src/documents/files"
import { buildFileIndex, filterItems, type IndexedItem } from "../../../../src/search/file-index"
import { sep } from "node:path"

/** A bounded, lazy index independent of which tree folders are expanded. */
export class FileSearch {
  query = ""
  items: IndexedItem[] = []
  selected = 0
  loading = false
  truncated = false
  error = ""
  private index: IndexedItem[] | undefined
  private pending: Promise<void> | undefined
  private disposed = false
  private listeners = new Set<() => void>()
  constructor(readonly root: string) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  private filter() { this.items = this.query.trim() ? filterItems(this.root, this.index ?? [], this.query.trim().replace(/[\\/]/g, sep), 80) : []; this.selected = 0 }
  invalidate() { this.index = undefined }
  async search(query: string) {
    this.query = query
    this.error = ""
    if (!query.trim()) { this.items = []; this.selected = 0; this.changed(); return }
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
        this.filter()
      } catch (error) {
        if (!this.disposed) this.error = error instanceof Error ? error.message : String(error)
      } finally { this.loading = false; this.pending = undefined; this.changed() }
    })()
    return this.pending
  }
  move(direction: number) { this.selected = Math.max(0, Math.min(this.selected + direction, this.items.length - 1)); this.changed() }
  dispose() { this.disposed = true; this.listeners.clear() }
}
