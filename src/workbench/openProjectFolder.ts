export function projectFolderCommand(root: string, platform = process.platform): string[] {
  if (platform === "win32") return ["explorer.exe", root]
  if (platform === "linux") return ["xdg-open", root]
  throw new Error("Abrir la carpeta del proyecto no está disponible en esta plataforma.")
}

export function openProjectFolder(root: string) {
  const process = Bun.spawn(projectFolderCommand(root), { stdin: "ignore", stdout: "ignore", stderr: "ignore", windowsHide: true })
  process.unref()
}
