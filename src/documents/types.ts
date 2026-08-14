import type { GitDiff } from "../git/status"

export type FileTab = { kind: "file"; source: "project" | "config"; path: string; content: string; savedContent: string; view: "source" | "preview" }
export type ManualTab = { kind: "manual"; path: string; content: string }
export type ImageTab = { kind: "image"; path: string; bytes: Uint8Array }
export type DiffTab = { kind: "diff"; path: string; diff: GitDiff }
export type OpenTab = FileTab | ManualTab | ImageTab | DiffTab
