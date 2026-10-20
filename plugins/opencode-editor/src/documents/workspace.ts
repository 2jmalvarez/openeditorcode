import { extname, relative, resolve, sep } from "node:path"
import { ensureInsideRoot, ExternalFileChangedError, MAX_FILE_BYTES, readImageFile, readTextFile, renameProjectEntry, writeTextFile } from "../../../../src/documents/files"

export type ViewPosition = { row: number; column: number; scrollX: number; scrollY: number }
export type Document = {
  kind?: "file" | "diff" | "image" | "help"
  targetPath?: string
  area?: "staged" | "changes"
  bytes?: Uint8Array
  view?: "source" | "preview"
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
export const isEditable = (document: Document | undefined) => Boolean(document && (!document.kind || document.kind === "file"))
export const isMarkdown = (path: string) => /\.(md|markdown|mdown)$/i.test(path)
export const isDirty = (document: Document) => isEditable(document) && normalize(document.content) !== normalize(document.savedContent)

type FileAccess = { read: typeof readTextFile; write: typeof writeTextFile }

/** Product state lives outside route components; filesystem operations retain OEC's safety checks. */
export class Workspace {
  readonly root: string
  documents: Document[] = []
  activePath: string | undefined
  private generation = 0
  private disposed = false
  private busy = new Set<string>()
  private renaming = false
  private listeners = new Set<() => void>()

  constructor(root: string, private files: FileAccess = { read: readTextFile, write: writeTextFile }, private markdownPreview = true) {
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
    if (this.disposed || this.renaming) return false
    const safePath = ensureInsideRoot(this.root, resolve(this.root, path))
    if (this.documents.some((document) => document.path === safePath)) { this.activate(safePath); return true }
    if (this.documents.length >= MAX_TABS) throw new Error(`Maximum ${MAX_TABS} open files`)
    const generation = ++this.generation
    const image = /\.(png|jpe?g|gif|webp)$/i.test(extname(safePath))
    const bytes = image ? await readImageFile(this.root, safePath) : undefined
    const content = image ? "" : await this.files.read(this.root, safePath)
    if (this.disposed || generation !== this.generation) return false
    this.documents.push({ kind: image ? "image" : "file", bytes, view: this.markdownPreview && isMarkdown(safePath) ? "preview" : "source", path: safePath, content: normalize(content), savedContent: content, position: emptyPosition(), conflict: false, version: 0 })
    this.activePath = safePath
    this.changed()
    return true
  }

  openView(kind: "diff" | "help", targetPath: string, content: string, area?: "staged" | "changes") {
    const target = ensureInsideRoot(this.root, resolve(this.root, targetPath))
    // A virtual ID must never alias the editable on-disk path.
    const path = `${target}\0oec:${kind}:${area ?? ""}`
    const existing = this.documents.find((document) => document.path === path)
    if (existing) { existing.content = content; existing.version++; this.activate(path); return }
    if (this.documents.length >= MAX_TABS) throw new Error(`Maximum ${MAX_TABS} open files`)
    this.documents.push({ kind, targetPath: target, area, path, content, savedContent: content, position: emptyPosition(), conflict: false, version: 0 })
    this.activate(path)
  }

  togglePreview() {
    const document = this.active
    if (!isEditable(document) || !document || !isMarkdown(document.path)) return
    document.view = document.view === "preview" ? "source" : "preview"
    this.changed()
  }
  setSource() { if (this.active && isEditable(this.active)) { this.active.view = "source"; this.changed() } }
  setMarkdownDefault(preview: boolean) { this.markdownPreview = preview }

  async rename(path: string, name: string): Promise<string> {
    if (this.busy.size || this.renaming) throw new Error("A file operation is in progress; try renaming again")
    const previous = ensureInsideRoot(this.root, resolve(this.root, path))
    this.generation++
    this.renaming = true
    try {
      const next = await renameProjectEntry(this.root, previous, name)
      const remap = (target: string) => {
        const rest = relative(previous, target)
        return rest === "" || (!rest.startsWith(`..${sep}`) && rest !== ".." && !/^[a-z]:/i.test(rest)) ? resolve(next, rest) : target
      }
      for (const document of this.documents) {
        const wasActive = this.activePath === document.path
        if (document.targetPath) {
          document.targetPath = remap(document.targetPath)
          document.path = `${document.targetPath}\0oec:${document.kind}:${document.area ?? ""}`
        } else document.path = remap(document.path)
        if (wasActive) this.activePath = document.path
      }
      this.changed()
      return next
    } finally { this.renaming = false }
  }

  edit(path: string, content: string) {
    const document = this.documents.find((entry) => entry.path === path)
    if (!document || !isEditable(document) || document.content === content) return
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
    if (!document || !isEditable(document) || this.disposed || this.renaming || this.busy.has(document.path)) return false
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
    if (!document || !isEditable(document) || this.disposed || this.renaming || this.busy.has(document.path)) return
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
    if (!document || !isEditable(document) || this.renaming || this.busy.has(path)) return false
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
    const snapshot: DraftSnapshot = { version: 1, root: this.root, activePath: isEditable(this.active) && this.activePath && include(this.activePath) ? this.activePath : undefined, documents }
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
      if (draft.path.includes("\0") || draft.path !== ensureInsideRoot(root, draft.path) || paths.has(draft.path)) return
      if (Buffer.byteLength(draft.savedContent, "utf8") > MAX_FILE_BYTES || draft.content.includes("\0") || draft.savedContent.includes("\0")) return
      if (!draft.position || ![draft.position.row, draft.position.column, draft.position.scrollX, draft.position.scrollY].every((number) => Number.isSafeInteger(number) && number >= 0 && number <= MAX_FILE_BYTES)) return
      paths.add(draft.path)
    }
    // Host durable values are Solid store proxies, which structuredClone cannot copy.
    return JSON.parse(JSON.stringify(snapshot)) as DraftSnapshot
  } catch { return }
}
