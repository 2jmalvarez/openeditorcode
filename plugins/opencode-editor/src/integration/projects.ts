import type { Context } from "@opencode/plugin/tui/context"
import { EditorController, EDITOR_ROUTE } from "./controller"
import { parseOptions, parsePreferences } from "./options"
import { createTranslator, type Translator } from "../localization"
import { createLocalAccess } from "./local-access"

/** One document/recovery/undo state per directory, independent of JSX lifetimes. */
export class EditorProjects {
  private controllers = new Map<string, EditorController>()
  private listeners = new Set<() => void>()
  private stops: (() => void)[] = []
  private active: EditorController | undefined
  private pending: Promise<EditorController | undefined> | undefined
  private disposed = false
  private confirming = false
  private access: ReturnType<typeof createLocalAccess> | undefined
  private text: Translator
  constructor(readonly context: Context) { this.text = createTranslator(parsePreferences(context.options).language) }
  get t() { return this.current()?.t ?? this.text }

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { if (!this.disposed) for (const listener of this.listeners) listener() }
  private localAccess() { return this.access ??= createLocalAccess(this.context.storage) }
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
    if (this.context.options.localRoot === undefined && !this.localAccess().trusted(options.localRoot)) {
      this.confirming = true; this.changed()
      try {
        const choice = await this.context.ui.dialog.select({
          title: this.t("OEC · Local access: {path}", { path: options.localRoot }),
          current: "once",
          options: [
            { title: this.t("Allow for this TUI only"), value: "once", description: options.localRoot, footer: this.t("Access on THIS computer only. OEC does not read the remote server's filesystem.") },
            { title: this.t("Allow and remember this folder"), value: "remember", description: options.localRoot, footer: this.t("Remember on this computer across restarts. Other folders still require permission.") },
            { title: this.t("Deny access"), value: "deny", footer: this.t("Do not open local project files.") },
          ],
        })
        if (this.disposed || (choice !== "once" && choice !== "remember")) return
        if (choice === "remember") await this.localAccess().remember(options.localRoot)
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
      else if (view === "diff") {
        controller.filesInputMode = mode
        controller.filesVisible = true; controller.filesExpanded = false
        if (!controller.diffVisible) controller.toggleDiff()
      }
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
  async forgetLocalAccess() {
    if (this.disposed || this.pending || this.modal) return
    this.confirming = true; this.changed()
    try {
      const access = this.localAccess()
      const folders = access.folders()
      if (!folders.length) {
        await this.context.ui.dialog.alert({ title: this.t("OEC · Remembered local access"), message: this.t("No folders have remembered access on this computer. An explicit localRoot override is controlled in cli.json.") })
        return
      }
      const folder = await this.context.ui.dialog.select({ title: this.t("OEC · Forget remembered local access"), options: folders.map((folder) => ({ title: folder, value: folder })) })
      if (!folder || this.disposed || !folders.includes(folder)) return
      const confirmed = await this.context.ui.dialog.confirm({ title: this.t("OEC · Forget this folder?"), message: this.t("Forget remembered access to {path}? Open documents stay available in this TUI. After restarting, OEC will ask again. An explicit localRoot override in cli.json still grants access.", { path: folder }) })
      if (!confirmed || this.disposed) return
      await access.forget(folder)
      this.context.ui.toast.show({ title: "OEC", message: this.t("Remembered access removed. OEC will ask again after restarting."), variant: "success" })
    } finally { this.confirming = false; this.changed() }
  }
  async run(action: () => Promise<unknown>) {
    try { await action() } catch (error) {
      if (!this.disposed) this.context.ui.toast.show({ title: "OEC", message: this.t(error instanceof Error ? error.message : String(error)), variant: "error" })
    }
  }
  async dispose() {
    this.disposed = true
    for (const stop of this.stops) stop()
    await Promise.all([...this.controllers.values()].map((controller) => controller.dispose()))
    this.controllers.clear(); this.listeners.clear()
  }
}
