import type { Context } from "@opencode/plugin/tui/context"
import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { ensurePhysicallyInsideRoot } from "../../../../src/documents/files"
import { Workspace, isDirty, validateSnapshot, type DraftSnapshot } from "../documents/workspace"
import { DraftWriter, draftKey } from "../documents/drafts"
import { TreeState } from "../explorer/tree-state"
import type { EditorOptions } from "./options"

export const EDITOR_ROUTE = "oec.editor"
export class EditorController {
  readonly workspace: Workspace
  readonly tree: TreeState
  readonly drafts: DraftWriter
  private origin: string | undefined
  private disposed = false
  private recovering: Promise<void> | undefined
  private recovered = false
  private navigation = 0
  private modalCount = 0
  private listeners = new Set<() => void>()
  status = "OEC · Local files"
  filesVisible = false
  filesFocused = false
  capture: (() => void) | undefined

  constructor(readonly context: Context, readonly options: EditorOptions) {
    this.workspace = new Workspace(options.localRoot)
    this.tree = new TreeState(this.workspace.root)
    // A new generation gets a new archive slot. Declining recovery must never overwrite an old draft.
    const instanceID = randomUUID()
    const key = draftKey(this.workspace.root, "recovery")
    const [archive, updateArchive] = context.storage.store(key, { initial: { instances: {} as Record<string, DraftSnapshot> } })
    this.recover = async () => {
      const candidates = Object.entries(archive.instances).filter(([, snapshot]) => validateSnapshot(this.workspace.root, snapshot)?.documents.length)
      if (!candidates.length) return
      const selected = await this.dialog(() => context.ui.dialog.select({
        title: "OEC · Recover unsaved files",
        options: candidates.map(([id, snapshot]) => ({ title: `${snapshot.documents.length} unsaved file(s) · ${id.slice(0, 8)}`, value: id })),
      }))
      if (!selected || this.disposed) return
      const snapshot = archive.instances[selected]
      if (!snapshot) return
      const count = this.workspace.restore(snapshot)
      if (count) this.setStatus(`Recovered ${count} file(s). Review and save explicitly.`)
      // Do not delete the source recovery entry until this instance has durably copied it.
      const current = this.workspace.snapshot()
      await updateArchive((draft) => {
        draft.instances[instanceID] = current
        delete draft.instances[selected]
      })
    }
    this.drafts = new DraftWriter(this.workspace, async (snapshot) => {
      if (!this.recovered) return
      await updateArchive((draft) => {
        if (snapshot.documents.length) draft.instances[instanceID] = snapshot
        else delete draft.instances[instanceID]
      })
    }, (error) => this.report(error))
  }

  private recover: () => Promise<void>
  get modal() { return this.modalCount > 0 }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  setStatus(message: string) { this.status = message; this.changed() }
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
    // Explicit localRoot is the user's local-access opt-in, never infer it from a remote location.
    return Boolean(directory && resolve(directory) === this.workspace.root)
  }

  async enter(sessionID?: string) {
    const generation = ++this.navigation
    const route = this.context.ui.router.current()
    const origin = sessionID ?? (route.type === "session" ? route.sessionID : this.origin)
    if (origin && !this.accepts(origin)) throw new Error("OEC: this session is not in the configured localRoot")
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
    this.filesVisible = !this.filesVisible
    this.filesFocused = this.filesVisible
    this.changed()
    if (this.filesVisible) await this.tree.refresh()
  }
  focusFiles(focused: boolean) { this.filesFocused = focused; this.changed() }
  async dispose() {
    this.navigation++
    this.capture?.()
    this.disposed = true
    await this.drafts.dispose()
    this.workspace.dispose(); this.tree.dispose(); this.listeners.clear()
  }
}
