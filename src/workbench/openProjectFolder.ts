import { t } from "../localization"

export function projectFolderCommand(root: string, platform = process.platform): string[] {
  if (platform === "win32") return ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Start-Process -FilePath explorer.exe -ArgumentList '/n,', '${root.replace(/'/g, "''")}' -ErrorAction Stop`]
  if (platform === "linux") return ["xdg-open", root]
  throw new Error(t("platform.openFolderUnsupported"))
}

export function projectFolderLaunchSucceeded(platform: string, exitCode: number | null): boolean {
  return exitCode === 0
}

export async function openProjectFolder(root: string) {
  const platform = process.platform
  const child = Bun.spawn(projectFolderCommand(root, platform), { stdin: "ignore", stdout: "ignore", stderr: "ignore", windowsHide: true })
  child.unref()
  const exitCode = await child.exited
  if (!projectFolderLaunchSucceeded(platform, exitCode)) throw new Error(`Folder launcher exited with code ${exitCode ?? "unknown"}`)
}
