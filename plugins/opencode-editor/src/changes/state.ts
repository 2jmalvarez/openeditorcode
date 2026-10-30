import type { Context } from "@opencode/plugin/tui/context"
import { resolve } from "node:path"
import { changesError, createChangesReader, type Change, type ChangesReader, type LocalRepository } from "./git"

export const CHANGES_POLL_MS = 3000
export const CHANGES_DEBOUNCE_MS = 150

/** Local, read-only Git state scoped to the consented project directory. */
export class ChangesState {
  files: Change[] = []
  repositories: LocalRepository[] = []
  loading = false
  /** Background polling/events retain the current view; only explicit refreshes show progress. */
  loadingVisible = false
  repository: boolean | undefined
  error = ""
  stale = false
  private listeners = new Set<() => void>()
  private running = false
  private generation = 0
  private pending: Promise<void> | undefined
  private rerun = false
  private rediscover = false
  private request: AbortController | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private debounce: ReturnType<typeof setTimeout> | undefined
  private stops: (() => void)[] = []
  constructor(readonly context: Context, readonly root: string, private read: ChangesReader = createChangesReader()) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { for (const listener of this.listeners) listener() }
  start(sessionID?: string) {
    if (this.running) return
    this.running = true
    const schedule = (event: { location?: { directory: string; workspaceID?: string } }) => {
      if (!event.location || event.location.workspaceID || resolve(event.location.directory) !== this.root || this.debounce) return
      this.debounce = setTimeout(() => { this.debounce = undefined; void this.refresh(false) }, CHANGES_DEBOUNCE_MS)
    }
    this.stops = [this.context.data.on("filesystem.changed", schedule), this.context.data.on("vcs.branch.updated", schedule)]
    this.timer = setInterval(() => { if (!this.pending) void this.refresh(false) }, CHANGES_POLL_MS)
    void this.refresh()
  }
  refresh(rediscover = true): Promise<void> {
    if (!this.running) return Promise.resolve()
    if (this.pending) {
      this.rerun = true; this.rediscover ||= rediscover
      if (rediscover && !this.loadingVisible) { this.loadingVisible = true; this.changed() }
      return this.pending
    }
    const generation = this.generation
    const request = this.request = new AbortController()
    const signal = request.signal
    this.loading = true; this.loadingVisible = rediscover; this.changed()
    this.pending = (async () => {
      try {
        const result = await this.read(this.root, signal, rediscover)
        if (!this.running || generation !== this.generation) return
        this.repository = result.repository
        const failed = new Set(result.repositories?.filter((repo) => repo.error).map((repo) => repo.root))
        this.files = [...result.files, ...this.files.filter((file) => file.repositoryRoot && failed.has(file.repositoryRoot))]
        this.repositories = (result.repositories ?? []).map((repo) => repo.error ? { ...repo, branch: repo.branch || this.repositories.find((previous) => previous.root === repo.root)?.branch || "" } : repo)
        this.stale = failed.size > 0 || !!result.discoveryError
        this.error = result.discoveryError ?? ""
      } catch (error) {
        if (this.running && generation === this.generation) { this.stale = true; this.error = changesError(error) }
      } finally {
        if (generation === this.generation) {
          this.loading = false; this.loadingVisible = false; this.pending = undefined; this.request = undefined; this.changed()
          if (this.rerun) { const rediscover = this.rediscover; this.rerun = false; this.rediscover = false; void this.refresh(rediscover) }
        }
      }
    })()
    return this.pending
  }
  stop() {
    this.running = false; this.generation++; this.rerun = false; this.rediscover = false
    this.request?.abort(); this.request = undefined; this.pending = undefined; this.loading = false; this.loadingVisible = false
    clearInterval(this.timer); clearTimeout(this.debounce); this.timer = undefined; this.debounce = undefined
    for (const stop of this.stops) stop()
    this.stops = []
  }
  dispose() { this.stop(); this.listeners.clear() }
}
