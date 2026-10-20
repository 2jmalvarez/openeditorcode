import type { Context } from "@opencode/plugin/tui/context"
import { randomUUID } from "node:crypto"
import { basename, resolve } from "node:path"
import { ensurePhysicallyInsideRoot, readTextFile } from "../../../../src/documents/files"
import { Workspace, isDirty, validateSnapshot, type DraftSnapshot } from "../documents/workspace"
import { DraftWriter, draftFilter, draftKey } from "../documents/drafts"
import { TreeState } from "../explorer/tree-state"
import { FileSearch } from "../explorer/file-search"
import { ChangesState } from "../changes/state"
import type { EditorOptions } from "./options"
import { changePath, readLocalPatch, type Change, type ChangesReader } from "../changes/git"

export const EDITOR_ROUTE = "oec.editor"
export class EditorController {
  readonly workspace: Workspace
  readonly tree: TreeState
  readonly fileSearch: FileSearch
  readonly changes: ChangesState
  readonly drafts: DraftWriter
  private origin: string | undefined
  private disposed = false
  private recovering: Promise<void> | undefined
  private recovered = false
  private navigation = 0
  private modalCount = 0
  private listeners = new Set<() => void>()
  private clearArchive: () => Promise<void>
  status = "OEC · Local files"
  wrapMode: "none" | "word" = "none"
  filesVisible = false
  editorFilesVisible = true
  filesExpanded = true
  diffVisible = true
  diffExpanded = true
  filesFocused = false
  filesInputMode: string | undefined
  capture: (() => void) | undefined
  editorAction: ((action: "find" | "focus") => void) | undefined
  onFilesHidden: (() => void) | undefined

  async inEditor(action: () => void | Promise<void>) {
    const route = this.context.ui.router.current()
    if (route.type !== "plugin" || route.name !== EDITOR_ROUTE) await this.enter()
    if (!this.disposed) await action()
  }

  constructor(readonly context: Context, readonly options: EditorOptions, changesReader?: ChangesReader) {
    this.workspace = new Workspace(options.localRoot, undefined, options.markdownPreview)
    this.tree = new TreeState(this.workspace.root)
    this.fileSearch = new FileSearch(this.workspace.root, options.searchMode)
    this.changes = new ChangesState(context, this.workspace.root, changesReader)
    // A new generation gets a new archive slot. Declining recovery must never overwrite an old draft.
    const instanceID = randomUUID()
    const key = draftKey(this.workspace.root, "recovery")
    const [archive, updateArchive] = context.storage.store(key, { initial: { instances: {} as Record<string, DraftSnapshot> } })
    const include = draftFilter(this.workspace.root, options.drafts.enabled, options.drafts.exclude)
    const filtered = (snapshot: DraftSnapshot): DraftSnapshot => ({ ...snapshot, activePath: snapshot.activePath && include(snapshot.activePath) ? snapshot.activePath : undefined, documents: snapshot.documents.filter((document) => include(document.path)) })
    this.clearArchive = async () => { await updateArchive((draft) => { draft.instances = {} }) }
    this.recover = async () => {
      if (!options.drafts.enabled) return
      // A policy change must not silently discard older user work. Excluded
      // legacy copies remain until the explicit, confirmed delete command.
      const candidates = Object.entries(archive.instances).flatMap(([id, value]) => {
        const valid = validateSnapshot(this.workspace.root, value)
        const safe = valid && filtered(valid)
        return safe?.documents.length ? [[id, safe] as const] : []
      })
      if (!candidates.length) return
      const selected = await this.dialog(() => context.ui.dialog.select({
        title: "OEC · Recover unsaved files",
        options: candidates.map(([id, snapshot]) => ({ title: `${snapshot.documents.length} unsaved file(s) · ${id.slice(0, 8)}`, value: id })),
      }))
      if (!selected || this.disposed) return
      const snapshot = validateSnapshot(this.workspace.root, archive.instances[selected])
      if (!snapshot) return
      const count = this.workspace.restore(filtered(snapshot))
      if (count) this.setStatus(`Recovered ${count} file(s). Review and save explicitly.`)
      // Do not delete the source recovery entry until this instance has durably copied it.
      const current = this.workspace.snapshot(include)
      await updateArchive((draft) => {
        draft.instances[instanceID] = current
        const excluded = snapshot.documents.filter((document) => !include(document.path))
        if (excluded.length) draft.instances[selected] = { ...snapshot, documents: excluded }
        else delete draft.instances[selected]
      })
    }
    this.drafts = new DraftWriter(this.workspace, async (snapshot) => {
      if (!this.recovered || !options.drafts.enabled) return
      await updateArchive((draft) => {
        if (snapshot.documents.length) draft.instances[instanceID] = snapshot
        else delete draft.instances[instanceID]
      })
    }, (error) => this.report(error), include)
  }

  private recover: () => Promise<void>
  async clearStoredDrafts() {
    if (!await this.dialog(() => this.context.ui.dialog.confirm({ title: "OEC · Delete stored drafts?", message: "Delete recovery copies for this project, including other terminal generations? Open documents and project files are not changed. Unsaved open documents may generate new drafts." }))) return
    await this.drafts.flush()
    await this.clearArchive()
    this.setStatus("Stored drafts deleted. Open documents were not changed.")
  }
  get modal() { return this.modalCount > 0 }
  get sessionID() { return this.origin }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  setStatus(message: string) { this.status = message; this.changed() }
  toggleWrap() { this.capture?.(); this.wrapMode = this.wrapMode === "none" ? "word" : "none"; this.setStatus(this.wrapMode === "word" ? "Line wrap on" : "Line wrap off") }
  toggleSearchMode() { this.fileSearch.setMode(this.fileSearch.mode === "fuzzy" ? "literal" : "fuzzy"); this.setStatus(`Search: ${this.fileSearch.mode}`) }
  toggleDiffView() { this.options.diffView = this.options.diffView === "split" ? "unified" : "split"; this.setStatus(`Diff: ${this.options.diffView}`) }
  toggleMarkdownDefault() { this.options.markdownPreview = !this.options.markdownPreview; this.workspace.setMarkdownDefault(this.options.markdownPreview); this.setStatus(`Markdown default: ${this.options.markdownPreview ? "preview" : "source"}`) }
  toggleImageProtocol() { this.options.imageProtocol = this.options.imageProtocol === "auto" ? "blocks" : "auto"; this.setStatus(`Images: ${this.options.imageProtocol}`) }
  async openDiff(file: Change, sessionID?: string) {
    if (sessionID && !this.accepts(sessionID)) throw new Error("Diff belongs to another project")
    const generation = ++this.navigation
    await this.ready()
    this.capture?.()
    const patch = await readLocalPatch(this.workspace.root, file)
    if (this.disposed || generation !== this.navigation) return
    this.workspace.openView("diff", changePath(this.workspace.root, file.path), patch, file.area)
    await this.enter(sessionID)
    this.setStatus("Git diff · disk/index, not unsaved edits · F4 edit current file")
  }
  async alternateView() {
    this.capture?.()
    const document = this.workspace.active
    if (!document) return
    if (document.kind === "diff" && document.targetPath) {
      // Read first: even an already-open buffer must not recreate a deleted file.
      await ensurePhysicallyInsideRoot(this.workspace.root, document.targetPath)
      await readTextFile(this.workspace.root, document.targetPath)
      await this.open(document.targetPath)
      this.workspace.setSource()
    } else this.workspace.togglePreview()
  }
  async renameSelected() {
    const search = this.fileSearch
    const item = search.query.trim() ? search.rows[search.selected] : this.tree.items[this.tree.selected]
    if (!item) return
    const name = await this.dialog(() => this.context.ui.dialog.prompt({ title: `OEC · Rename ${basename(item.path)}`, placeholder: basename(item.path) }))
    if (!name || this.disposed) return
    this.capture?.()
    const next = await this.dialog(() => this.workspace.rename(item.path, name))
    this.tree.remap(item.path, next)
    await this.tree.refresh(); await this.fileSearch.refresh(); await this.changes.refresh(); await this.drafts.flush()
    const index = this.tree.items.findIndex((entry) => entry.path === next)
    if (index >= 0) this.tree.select(index)
    this.setStatus(`Renamed to ${basename(next)}`)
  }
  report(error: unknown) {
    this.setStatus(error instanceof Error ? error.message : String(error))
    if (!this.disposed) this.context.ui.toast.show({ title: "OEC", message: this.status, variant: "error" })
  }
  async run(action: () => Promise<unknown>) { try { await action() } catch (error) { this.report(error) } }
  async dialog<T>(action: () => Promise<T>): Promise<T> {
    this.modalCount++; this.changed()
    try { return await action() } finally { this.modalCount--; this.changed() }
  }

  async ready() {
    if (!this.recovering) this.recovering = this.recover().then(() => { this.recovered = true }).catch((error) => { this.recovering = undefined; throw error })
    await this.recovering
  }

  private sessionRoot(sessionID: string): string | undefined {
    return this.context.data.session.get(sessionID)?.location.directory
  }
  accepts(sessionID: string): boolean {
    const directory = this.sessionRoot(sessionID)
    // Root access is explicit via localRoot or confirmed by EditorProjects.
    return Boolean(directory && resolve(directory) === this.workspace.root)
  }

  async enter(sessionID?: string) {
    const generation = ++this.navigation
    const route = this.context.ui.router.current()
    const origin = sessionID ?? (route.type === "session" ? route.sessionID : this.origin)
    if (origin && !this.accepts(origin)) throw new Error("OEC: this session is not in the selected project (localRoot)")
    await ensurePhysicallyInsideRoot(this.workspace.root, this.workspace.root)
    await this.ready()
    if (this.disposed || generation !== this.navigation) return
    this.capture?.()
    this.origin = origin
    this.filesFocused = false
    this.context.ui.router.navigate({ type: "plugin", name: EDITOR_ROUTE })
    await this.tree.refresh()
    await this.workspace.checkExternal()
  }

  async back() {
    const generation = ++this.navigation
    this.workspace.cancelPendingOpen()
    this.capture?.()
    await this.drafts.flush()
    if (this.disposed || generation !== this.navigation) return
    if (this.origin && this.context.data.session.get(this.origin)) this.context.ui.router.navigate({ type: "session", sessionID: this.origin })
    else this.context.ui.router.navigate({ type: "home" })
  }

  async toggle() {
    const route = this.context.ui.router.current()
    if (route.type === "plugin" && route.name === EDITOR_ROUTE && route.id === "oec.editor") await this.back()
    else await this.enter()
  }

  toggleDiff() { this.diffVisible = !this.diffVisible; if (this.diffVisible) this.diffExpanded = true; this.changed() }
  toggleDiffExpanded() { this.diffExpanded = !this.diffExpanded; this.changed() }
  toggleFilesExpanded() { this.filesExpanded = !this.filesExpanded; this.changed() }
  private filesOwnFocus() {
    let node = this.context.renderer?.currentFocusedRenderable
    while (node) {
      if (node.id === "oec-files-section") return true
      node = node.parent
    }
    return false
  }
  async toggleEditorFiles() {
    const focused = this.filesOwnFocus()
    this.editorFilesVisible = !this.editorFilesVisible; this.changed()
    if (this.editorFilesVisible) await this.tree.refresh()
    else if (focused) this.onFilesHidden?.()
  }
  async open(path: string, sessionID?: string) {
    const generation = ++this.navigation
    if (sessionID && !this.accepts(sessionID)) throw new Error("OEC: this session is not in the configured localRoot")
    await this.ready()
    if (this.disposed || generation !== this.navigation) return
    this.capture?.()
    if (!await this.workspace.open(path)) return
    if (this.disposed || generation !== this.navigation) return
    await this.enter(sessionID)
    this.setStatus(`Opened ${path}`)
  }

  activate(path: string) { this.capture?.(); this.workspace.activate(path) }
  async save(path = this.workspace.activePath) {
    this.capture?.()
    if (await this.workspace.save(path)) { this.setStatus("Saved"); await this.drafts.flush(); return true }
    return false
  }
  async close(path: string) {
    this.capture?.()
    const document = this.workspace.documents.find((entry) => entry.path === path)
    if (!document) return
    const version = document.version
    if (isDirty(document)) {
      const choice = await this.dialog(() => this.context.ui.dialog.select({ title: "OEC · Unsaved changes", options: [
        { title: "Cancel", value: "cancel" }, { title: "Save and close", value: "save" }, { title: "Close without saving", value: "discard" },
      ] }))
      if (this.disposed || !choice || choice === "cancel") return
      if (choice === "save" && !await this.save(path)) return
      if (!this.workspace.close(path, choice === "discard" ? version : undefined)) this.setStatus("File changed during confirmation; close cancelled.")
    } else this.workspace.close(path)
    await this.drafts.flush()
  }

  async reload() {
    this.capture?.()
    const document = this.workspace.active
    if (!document) return
    const { path, version } = document
    if (isDirty(document) && !await this.dialog(() => this.context.ui.dialog.confirm({ title: "OEC · Reload from disk?", message: "Discard local edits? A deleted file will not be recreated." }))) return
    if (await this.workspace.reload(path, version)) { this.setStatus("Reloaded from disk"); await this.drafts.flush() }
  }

  async toggleFiles() {
    const route = this.context.ui.router.current()
    if (route.type !== "session" || !this.accepts(route.sessionID)) throw new Error("OEC: open a session in localRoot first")
    const focused = this.filesOwnFocus()
    this.filesVisible = !this.filesVisible
    this.filesInputMode ??= this.context.keymap.mode.current()
    this.filesFocused = this.filesVisible
    this.changed()
    if (this.filesVisible) await this.tree.refresh()
    else if (focused) this.onFilesHidden?.()
  }
  focusFiles(focused: boolean) { this.filesFocused = focused; this.changed() }
  async dispose() {
    this.navigation++
    this.capture?.()
    this.disposed = true
    await this.drafts.dispose()
    this.workspace.dispose(); this.tree.dispose(); this.fileSearch.dispose(); this.changes.dispose(); this.listeners.clear()
  }
}
