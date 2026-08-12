import type { GitDiff } from "../git/status"

export type FileTab = { kind: "file"; path: string; content: string; savedContent: string }
export type DiffTab = { kind: "diff"; path: string; diff: GitDiff }
export type OpenTab = FileTab | DiffTab
