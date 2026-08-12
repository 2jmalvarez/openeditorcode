import type { TextareaRenderable } from "@opentui/core"

export async function readClipboard(): Promise<string> {
  if (process.platform !== "win32") return ""
  const processHandle = Bun.spawn(["powershell.exe", "-NoProfile", "-Command", "Get-Clipboard -Raw"], { stdout: "pipe", stderr: "pipe" })
  const text = await new Response(processHandle.stdout).text()
  await processHandle.exited
  return text.replace(/\r?\n$/, "")
}

export function selectedText(editor: TextareaRenderable | undefined): string | undefined {
  const text = editor?.getSelectedText()
  return text || undefined
}
