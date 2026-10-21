import type { Change } from "./git"

export function changePresentation(change: Change) {
  const tone = change.status === "added" || change.status === "untracked" ? "added"
    : change.status === "deleted" ? "removed" : "modified"
  return {
    symbol: change.area === "staged" ? "●" : "○",
    indicator: change.area === "staged" ? "staged" as const : tone,
    status: change.status === "untracked" ? "?" : change.status[0].toUpperCase(),
    tone,
    additions: `+${change.additions ?? "?"}`,
    deletions: `−${change.deletions ?? "?"}`,
  } as const
}
