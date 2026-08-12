import type { FocusTarget } from "./types"

export async function refreshFocusedPanel(
  active: FocusTarget,
  refreshExplorer: () => Promise<void>,
  refreshGit: () => Promise<void>,
) {
  if (active === "git") await refreshGit()
  else await refreshExplorer()
}
