import type { TextareaRenderable } from "@opentui/core"

export async function readClipboard(): Promise<string> {
  const command = clipboardCommand()
  if (!command) return ""
  const processHandle = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const text = await new Response(processHandle.stdout).text()
  await processHandle.exited
  return text.replace(/\r?\n$/, "")
}

function clipboardCommand(): string[] | undefined {
  if (process.platform === "win32") return ["powershell.exe", "-NoProfile", "-Command", "Get-Clipboard -Raw"]
  if (process.platform !== "linux") return undefined
  if (Bun.which("wl-paste")) return ["wl-paste", "--no-newline"]
  if (Bun.which("xclip")) return ["xclip", "-selection", "clipboard", "-o"]
  if (Bun.which("xsel")) return ["xsel", "--clipboard", "--output"]
  return undefined
}

export function selectedText(editor: TextareaRenderable | undefined): string | undefined {
  const text = editor?.getSelectedText()
  return text || undefined
}
