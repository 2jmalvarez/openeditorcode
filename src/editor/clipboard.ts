export type TextSelectionSource = { getSelectedText(): string }

export async function readClipboard(options: { preserveTrailingNewline?: boolean } = {}): Promise<string> {
  const command = clipboardCommand(options.preserveTrailingNewline)
  if (!command) return ""
  const processHandle = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const text = await new Response(processHandle.stdout).text()
  if (await processHandle.exited !== 0) throw new Error("Could not read the clipboard")
  return options.preserveTrailingNewline ? text : text.replace(/\r?\n$/, "")
}

function clipboardCommand(preserveTrailingNewline = false): string[] | undefined {
  if (process.platform === "win32") return ["powershell.exe", "-NoProfile", "-Command", preserveTrailingNewline ? "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::Out.Write((Get-Clipboard -Raw))" : "Get-Clipboard -Raw"]
  if (process.platform !== "linux") return undefined
  if (Bun.which("wl-paste")) return ["wl-paste", "--no-newline"]
  if (Bun.which("xclip")) return ["xclip", "-selection", "clipboard", "-o"]
  if (Bun.which("xsel")) return ["xsel", "--clipboard", "--output"]
  return undefined
}

export function selectedText(editor: TextSelectionSource | undefined): string | undefined {
  const text = editor?.getSelectedText()
  return text || undefined
}
