import type { Context } from "@opencode/plugin/tui/context"
import { resolve } from "node:path"
import { readLocalChanges, type Change, type ChangesReader } from "./git"

export const CHANGES_POLL_MS = 3000
export const CHANGES_DEBOUNCE_MS = 150

/** Local, read-only Git state scoped to the consented project directory. */
export class ChangesState {
  files: Change[] = []
  loading = false
  repository: boolean | undefined
  error = ""
  private listeners = new Set<() => void>()
  private running = false
  private generation = 0
  private pending: Promise<void> | undefined
  private rerun = false
  private request: AbortController | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private debounce: ReturnType<typeof setTimeout> | undefined
  private stops: (() => void)[] = []
  constructor(readonly context: Context, readonly root: string, private read: ChangesReader = readLocalChanges) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { for (const listener of this.listeners) listener() }
  start(sessionID?: string) {
    if (this.running) return
    this.running = true
    const schedule = (event: { location?: { directory: string; workspaceID?: string } }) => {
      if (!event.location || event.location.workspaceID || resolve(event.location.directory) !== this.root || this.debounce) return
      this.debounce = setTimeout(() => { this.debounce = undefined; void this.refresh() }, CHANGES_DEBOUNCE_MS)
    }
    this.stops = [this.context.data.on("filesystem.changed", schedule), this.context.data.on("vcs.branch.updated", schedule)]
    this.timer = setInterval(() => { void this.refresh() }, CHANGES_POLL_MS)
    void this.refresh()
  }
  refresh(): Promise<void> {
    if (!this.running) return Promise.resolve()
    if (this.pending) { this.rerun = true; return this.pending }
    const generation = this.generation
    const request = this.request = new AbortController()
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)])
    this.loading = true; this.changed()
    this.pending = (async () => {
      try {
        const result = await this.read(this.root, signal)
        if (!this.running || generation !== this.generation) return
        this.repository = result.repository
        this.files = result.files
        this.error = ""
      } catch (error) {
        if (this.running && generation === this.generation) { this.files = []; this.error = error instanceof Error ? error.message : String(error) }
      } finally {
        if (generation === this.generation) {
          this.loading = false; this.pending = undefined; this.request = undefined; this.changed()
          if (this.rerun) { this.rerun = false; void this.refresh() }
        }
      }
    })()
    return this.pending
  }
  stop() {
    this.running = false; this.generation++; this.rerun = false
    this.request?.abort(); this.request = undefined; this.pending = undefined; this.loading = false
    clearInterval(this.timer); clearTimeout(this.debounce); this.timer = undefined; this.debounce = undefined
    for (const stop of this.stops) stop()
    this.stops = []
  }
  dispose() { this.stop(); this.listeners.clear() }
}
