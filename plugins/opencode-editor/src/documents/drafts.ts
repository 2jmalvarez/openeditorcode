import { createHash } from "node:crypto"
import type { DraftSnapshot, Workspace } from "./workspace"

/** Separate each terminal instance: live-synced host storage must not overwrite another editor's drafts. */
export function draftKey(root: string, instanceID: string) {
  return `drafts.${createHash("sha256").update(root).digest("hex")}.${instanceID}`
}

export class DraftWriter {
  private timer: ReturnType<typeof setTimeout> | undefined
  private deadline: ReturnType<typeof setTimeout> | undefined
  private tail: Promise<void> = Promise.resolve()
  private stop: () => void
  constructor(private workspace: Workspace, private write: (snapshot: DraftSnapshot) => Promise<void>, private report: (error: unknown) => void) {
    this.stop = workspace.subscribe(() => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => { this.timer = undefined; void this.flush() }, 300)
      // Continuous typing or scrolling must not postpone recovery writes indefinitely.
      this.deadline ??= setTimeout(() => { this.deadline = undefined; void this.flush() }, 2000)
    })
  }
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    if (this.deadline) clearTimeout(this.deadline)
    this.timer = undefined
    this.deadline = undefined
    let snapshot: DraftSnapshot
    try { snapshot = this.workspace.snapshot() } catch (error) { this.report(error); return Promise.resolve() }
    this.tail = this.tail.then(() => this.write(snapshot)).catch(this.report)
    return this.tail
  }
  dispose() { this.stop(); return this.flush() }
}
