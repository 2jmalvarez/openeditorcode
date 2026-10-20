import type { Context } from "@opencode/plugin/tui/context"
import { EditorController, EDITOR_ROUTE } from "./controller"
import { parseOptions } from "./options"

/** One document/recovery/undo state per directory, independent of JSX lifetimes. */
export class EditorProjects {
  private controllers = new Map<string, EditorController>()
  private listeners = new Set<() => void>()
  private stops: (() => void)[] = []
  private active: EditorController | undefined
  private pending: Promise<EditorController | undefined> | undefined
  private disposed = false
  private confirming = false
  constructor(readonly context: Context) {}

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  get modal() { return this.confirming || [...this.controllers.values()].some((controller) => controller.modal) }

  private options(sessionID?: string) {
    // Missing session data must never fall back to another session's directory.
    const location = sessionID ? this.context.data.session.get(sessionID)?.location : this.context.location ?? this.context.data.location.default()
    if (sessionID && !location) throw new Error("OEC: session location is not available yet")
    if (((location && "workspaceID" in location && location.workspaceID) || this.context.location?.workspaceID) && this.context.options.localRoot === undefined) throw new Error("OEC: remote workspaces require an explicit localRoot mapping; remote filesystem access is not supported")
    return parseOptions(this.context.options, location?.directory)
  }

  forSession(sessionID: string) {
    try {
      const controller = this.controllers.get(this.options(sessionID).localRoot)
      return controller?.accepts(sessionID) ? controller : undefined
    } catch { return undefined }
  }
  current() {
    const route = this.context.ui.router.current()
    return route.type === "plugin" && route.name === EDITOR_ROUTE ? this.active
      : route.type === "session" ? this.forSession(route.sessionID) : undefined
  }

  private async acquire(sessionID?: string) {
    const options = this.options(sessionID)
    const previous = this.controllers.get(options.localRoot)
    if (previous) return previous
    // LocationRef does not prove that the server shares our filesystem. Confirm
    // local access, not merely the existence of a coincidentally matching path.
    if (this.context.options.localRoot === undefined) {
      this.confirming = true; this.changed()
      try {
        if (!await this.context.ui.dialog.confirm({ title: "OEC · Open local project files?", message: `Allow access to ${options.localRoot} on THIS computer? OEC does not read the remote server's filesystem. This confirmation is remembered for this directory until the TUI exits.` })) return
      } finally { this.confirming = false; this.changed() }
      // Let the host finish restoring its prompt after resolving the dialog.
      // Mounting/focusing Files before that handoff loses keyboard focus; fixing
      // it with a per-frame focus loop would instead steal input from the chat.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    if (this.disposed) return
    const controller = new EditorController(this.context, options)
    this.controllers.set(options.localRoot, controller)
    this.stops.push(controller.subscribe(() => this.changed()))
    this.changed()
    return controller
  }

  private async activate(view: "editor" | "files" | "diff", sessionID?: string) {
    if (this.pending || this.disposed || this.modal) return
    const route = this.context.ui.router.current()
    const id = sessionID ?? (route.type === "session" ? route.sessionID : undefined)
    const mode = this.context.keymap.mode.current()
    this.pending = this.acquire(id)
    try {
      const controller = await this.pending
      // The user can switch sessions while the confirmation is open.
      const current = this.context.ui.router.current()
      if (!controller || this.disposed || current.type !== route.type || (current.type === "session" && route.type === "session" && current.sessionID !== route.sessionID)) return
      this.active = controller
      if (view === "files") { controller.filesInputMode = mode; await controller.toggleFiles() }
      else if (view === "diff") { controller.filesInputMode = mode; controller.toggleDiff() }
      else await controller.enter(id)
      this.changed()
    } finally { this.pending = undefined }
  }

  async toggle() {
    const route = this.context.ui.router.current()
    if (this.modal) return
    if (route.type === "plugin" && route.name === EDITOR_ROUTE && this.active) await this.active.back()
    else await this.activate("editor")
  }
  async toggleFiles() {
    if (this.modal) return
    const controller = this.current()
    if (controller && this.context.ui.router.current().type === "plugin") await controller.toggleEditorFiles()
    else await this.activate("files")
  }
  async toggleDiff() {
    if (this.modal) return
    const controller = this.current()
    if (controller) controller.toggleDiff()
    else if (this.context.ui.router.current().type === "session") await this.activate("diff")
  }
  async run(action: () => Promise<unknown>) {
    try { await action() } catch (error) {
      if (!this.disposed) this.context.ui.toast.show({ title: "OEC", message: error instanceof Error ? error.message : String(error), variant: "error" })
    }
  }
  async dispose() {
    this.disposed = true
    for (const stop of this.stops) stop()
    await Promise.all([...this.controllers.values()].map((controller) => controller.dispose()))
    this.controllers.clear(); this.listeners.clear()
  }
}
