import { join, resolve } from "node:path"
import { ensureInsideRoot, ensurePhysicallyInsideRoot, MAX_FILE_BYTES, readTextFile } from "../../../../src/documents/files"
import { parseWslPath } from "../../../../src/documents/wsl-save"
import { parseGitStatus, parseGitNumstat, type GitFile } from "../../../../src/git/status"

export type Change = GitFile & { file: string }
export type LocalChanges = { repository: boolean; files: Change[] }
export type ChangesReader = (root: string, signal: AbortSignal) => Promise<LocalChanges>

/** No shell interpolation; WSL repositories use their own distribution's Git. */
export function gitCommand(root: string, args: string[], platform = process.platform): string[] {
  const wsl = platform === "win32" ? parseWslPath(root) : undefined
  const command = ["git", "--no-optional-locks", "--literal-pathspecs", "-c", "core.quotepath=false", "-C", wsl?.path ?? root, ...args]
  return wsl ? [join(process.env.SystemRoot || "C:\\Windows", "System32", "wsl.exe"), "--distribution", wsl.distribution, "--exec", ...command] : command
}

async function limited(stream: ReadableStream<Uint8Array>, limit: number, abort: () => void): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { abort(); throw new Error("Git output exceeds the 2 MiB viewer limit") }
      chunks.push(value)
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
  } finally { reader.releaseLock() }
}

async function git(root: string, args: string[], signal?: AbortSignal) {
  const child = Bun.spawn(gitCommand(root, args), { stdin: "ignore", stdout: "pipe", stderr: "pipe", windowsHide: true,
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10_000)]) })
  const [stdout, stderr, code] = await Promise.all([limited(child.stdout, MAX_FILE_BYTES, () => child.kill()), limited(child.stderr, 64 * 1024, () => child.kill()), child.exited])
  return { stdout, stderr, code }
}

export function changePath(root: string, path: string): string {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) throw new Error("Invalid Git file path")
  return ensureInsideRoot(root, resolve(root, path))
}

export const readLocalChanges: ChangesReader = async (root, signal) => {
  await ensurePhysicallyInsideRoot(root, root)
  const info = await git(root, ["rev-parse", "--is-inside-work-tree"], signal)
  if (info.code !== 0) {
    if (/not a git repository/i.test(info.stderr)) return { repository: false, files: [] }
    throw new Error(info.stderr.trim() || "Could not inspect local Git repository")
  }
  const [status, prefix, staged, working] = await Promise.all([
    git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], signal),
    git(root, ["rev-parse", "--show-prefix"], signal),
    git(root, ["diff", "--no-ext-diff", "--no-textconv", "--cached", "--numstat", "-z"], signal),
    git(root, ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "-z"], signal),
  ])
  for (const result of [status, prefix, staged, working]) if (result.code) throw new Error(result.stderr.trim() || "Local Git status failed")
  const base = prefix.stdout.replace(/\r?\n$/, "")
  const stats = { staged: parseGitNumstat(staged.stdout), changes: parseGitNumstat(working.stdout) }
  const files = parseGitStatus(status.stdout).flatMap((entry): Change[] => {
    const inside = entry.path.startsWith(base)
    const oldInside = (entry.previousPath ?? entry.path).startsWith(base)
    if (!inside && !oldInside) return []
    const file = { ...entry, ...stats[entry.area].get(entry.path) }
    if (inside !== oldInside) {
      file.path = (inside ? entry.path : entry.previousPath!).slice(base.length)
      file.status = inside ? "added" : "deleted"; delete file.previousPath
    } else {
      file.path = file.path.slice(base.length)
      if (file.previousPath) file.previousPath = file.previousPath.slice(base.length)
    }
    changePath(root, file.path)
    if (file.previousPath) changePath(root, file.previousPath)
    return [{ ...file, file: file.path }]
  })
  return { repository: true, files }
}

export async function readLocalPatch(root: string, file: Change): Promise<string> {
  const path = changePath(root, file.path)
  await ensurePhysicallyInsideRoot(root, path)
  if (file.previousPath) await ensurePhysicallyInsideRoot(root, changePath(root, file.previousPath))
  if (file.status === "untracked") {
    const content = await readTextFile(root, path)
    if (!content) return ""
    const lines = content.split("\n")
    if (content.endsWith("\n")) lines.pop()
    return `diff --git ${JSON.stringify(`a/${file.path}`)} ${JSON.stringify(`b/${file.path}`)}\n--- /dev/null\n+++ ${JSON.stringify(`b/${file.path}`)}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}\n${content.endsWith("\n") ? "" : "\\ No newline at end of file\n"}`
  }
  const paths = [file.path, ...(file.previousPath ? [file.previousPath] : [])]
  const result = await git(root, ["diff", "--no-ext-diff", "--no-textconv", "--no-color", ...(file.area === "staged" ? ["--cached"] : []), "--", ...paths])
  if (result.code) throw new Error(result.stderr.trim() || "Could not read local diff")
  return result.stdout
}
