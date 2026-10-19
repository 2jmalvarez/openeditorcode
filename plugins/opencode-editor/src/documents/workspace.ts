import { resolve } from "node:path"
import { ensureInsideRoot, ExternalFileChangedError, MAX_FILE_BYTES, readTextFile, writeTextFile } from "../../../../src/documents/files"

export type ViewPosition = { row: number; column: number; scrollX: number; scrollY: number }
export type Document = {
  path: string
  content: string
  savedContent: string
  position: ViewPosition
  conflict: boolean
  version: number
}
export type Draft = Pick<Document, "path" | "content" | "savedContent" | "position">
export type DraftSnapshot = { version: 1; root: string; activePath?: string; documents: Draft[] }
export const MAX_TABS = 64
export const MAX_DRAFT_BYTES = 16 * 1024 * 1024
export const emptyPosition = (): ViewPosition => ({ row: 0, column: 0, scrollX: 0, scrollY: 0 })
export const normalize = (text: string) => text.replace(/\r\n?/g, "\n")
export const isDirty = (document: Document) => normalize(document.content) !== normalize(document.savedContent)

type FileAccess = { read: typeof readTextFile; write: typeof writeTextFile }

/** Product state lives outside route components; filesystem operations retain OEC's safety checks. */
export class Workspace {
  readonly root: string
  documents: Document[] = []
  activePath: string | undefined
  private generation = 0
  private disposed = false
  private busy = new Set<string>()
  private listeners = new Set<() => void>()

  constructor(root: string, private files: FileAccess = { read: readTextFile, write: writeTextFile }) {
    this.root = resolve(root)
  }

  get active() { return this.documents.find((document) => document.path === this.activePath) }
  cancelPendingOpen() { this.generation++ }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }

  activate(path: string) {
    if (!this.documents.some((document) => document.path === path)) return
    this.generation++
    this.activePath = path
    this.changed()
  }

  async open(path: string): Promise<boolean> {
    if (this.disposed) return false
    const safePath = ensureInsideRoot(this.root, resolve(this.root, path))
    if (this.documents.some((document) => document.path === safePath)) { this.activate(safePath); return true }
    if (this.documents.length >= MAX_TABS) throw new Error(`Maximum ${MAX_TABS} open files`)
    const generation = ++this.generation
    const content = await this.files.read(this.root, safePath)
    if (this.disposed || generation !== this.generation) return false
    this.documents.push({ path: safePath, content: normalize(content), savedContent: content, position: emptyPosition(), conflict: false, version: 0 })
    this.activePath = safePath
    this.changed()
    return true
  }

  edit(path: string, content: string) {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || document.content === content) return
    document.content = content
    document.version++
    this.changed()
  }

  remember(path: string, position: ViewPosition) {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || JSON.stringify(document.position) === JSON.stringify(position)) return
    document.position = { ...position }
    this.changed()
  }

  async save(path = this.activePath): Promise<boolean> {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || this.disposed || this.busy.has(document.path)) return false
    this.busy.add(document.path)
    const normalized = normalize(document.content)
    const content = document.savedContent.includes("\r\n") ? normalized.replace(/\n/g, "\r\n") : normalized
    try {
      // Always compare against the last known disk version. No silent force-overwrite option.
      await this.files.write(this.root, document.path, content, { expectedContent: document.savedContent })
      document.savedContent = content
      document.conflict = false
      this.changed()
      return true
    } catch (error) {
      if (error instanceof ExternalFileChangedError) { document.conflict = true; this.changed() }
      throw error
    } finally { this.busy.delete(document.path) }
  }

  async checkExternal(path = this.activePath) {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || this.disposed || this.busy.has(document.path)) return
    this.busy.add(document.path)
    try {
      const content = await this.files.read(this.root, document.path)
      if (this.disposed || !this.documents.includes(document)) return
      if (content === document.savedContent) {
        if (document.conflict) { document.conflict = false; this.changed() }
        return
      }
      if (isDirty(document)) document.conflict = true
      else {
        document.savedContent = content
        document.content = normalize(content)
        document.version++
        document.conflict = false
      }
      this.changed()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") { document.conflict = true; this.changed(); return }
      throw error
    } finally { this.busy.delete(document.path) }
  }

  async reload(path: string, expectedVersion: number): Promise<boolean> {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || this.busy.has(path)) return false
    this.busy.add(path)
    try {
      const content = await this.files.read(this.root, path)
      if (this.disposed || !this.documents.includes(document) || document.version !== expectedVersion) return false
      document.content = normalize(content)
      document.savedContent = content
      document.conflict = false
      document.version++
      this.changed()
      return true
    } finally { this.busy.delete(path) }
  }

  close(path: string, discardVersion?: number): boolean {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || this.busy.has(path)) return false
    if (isDirty(document) && discardVersion !== document.version) return false
    this.generation++
    const index = this.documents.indexOf(document)
    this.documents.splice(index, 1)
    if (this.activePath === path) this.activePath = this.documents[Math.min(index, this.documents.length - 1)]?.path
    this.changed()
    return true
  }

  snapshot(include: (path: string) => boolean = () => true): DraftSnapshot {
    const documents = this.documents.filter((document) => isDirty(document) && include(document.path)).map(({ path, content, savedContent, position }) => ({ path, content, savedContent, position: { ...position } }))
    const snapshot: DraftSnapshot = { version: 1, root: this.root, activePath: this.activePath && include(this.activePath) ? this.activePath : undefined, documents }
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > MAX_DRAFT_BYTES) throw new Error("Draft limit (16 MiB) exceeded. Save files to protect your work.")
    return snapshot
  }

  restore(value: unknown): number {
    const snapshot = validateSnapshot(this.root, value)
    if (!snapshot) return 0
    let restored = 0
    for (const draft of snapshot.documents) {
      if (this.documents.some((document) => document.path === draft.path)) continue
      this.documents.push({ ...draft, content: normalize(draft.content), conflict: false, version: 0 })
      restored++
    }
    if (restored) {
      this.activePath = this.documents.find((document) => document.path === snapshot.activePath)?.path ?? this.documents[0]?.path
      this.changed()
    }
    return restored
  }

  dispose() { this.disposed = true; this.generation++; this.listeners.clear() }
}

export function validateSnapshot(root: string, value: unknown): DraftSnapshot | undefined {
  if (!value || typeof value !== "object") return
  const snapshot = value as Partial<DraftSnapshot>
  if (snapshot.version !== 1 || snapshot.root !== resolve(root) || !Array.isArray(snapshot.documents) || snapshot.documents.length > MAX_TABS) return
  try {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_DRAFT_BYTES) return
    const paths = new Set<string>()
    for (const draft of snapshot.documents) {
      if (!draft || typeof draft.path !== "string" || typeof draft.content !== "string" || typeof draft.savedContent !== "string") return
      if (draft.path !== ensureInsideRoot(root, draft.path) || paths.has(draft.path)) return
      if (Buffer.byteLength(draft.savedContent, "utf8") > MAX_FILE_BYTES || draft.content.includes("\0") || draft.savedContent.includes("\0")) return
      if (!draft.position || ![draft.position.row, draft.position.column, draft.position.scrollX, draft.position.scrollY].every((number) => Number.isSafeInteger(number) && number >= 0 && number <= MAX_FILE_BYTES)) return
      paths.add(draft.path)
    }
    // Host durable values are Solid store proxies, which structuredClone cannot copy.
    return JSON.parse(JSON.stringify(snapshot)) as DraftSnapshot
  } catch { return }
}
