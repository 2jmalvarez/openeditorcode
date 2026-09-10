import { join } from "node:path"
import { ensureInsideRoot, MAX_FILE_BYTES } from "../documents/files"
import type { GitDiff, GitFile } from "./status"

export type GitCommit = { revision: string; author: string; date: string; subject: string }
export type GitBranch = { ref: string; name: string; revision: string; current: boolean; remote: boolean }
export type GitHistoryPage = { revision?: string; commits: GitCommit[]; hasMore: boolean }
export const GIT_HISTORY_PAGE_SIZE = 100

async function git(root: string, args: string[], signal?: AbortSignal, limit = 16 * 1024 * 1024, optional = false): Promise<string | undefined> {
  const process = Bun.spawn(["git", "--no-pager", "-C", root, ...args], { stdout: "pipe", stderr: "ignore", signal, env: { ...Bun.env, GIT_OPTIONAL_LOCKS: "0" } })
  const reader = process.stdout.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error("La salida de Git supera el limite permitido.")
      chunks.push(value)
    }
    if (await process.exited !== 0) {
      if (optional && !signal?.aborted) return undefined
      throw new Error("No se pudo leer el historial de Git.")
    }
    signal?.throwIfAborted()
    const data = Buffer.concat(chunks)
    if (limit === MAX_FILE_BYTES && data.includes(0)) throw new Error("Los archivos binarios no se pueden mostrar.")
    return new TextDecoder("utf-8", { fatal: true }).decode(data)
  } finally {
    reader.releaseLock()
    if (process.exitCode === null) process.kill()
    await process.exited
  }
}

async function resolveCommit(root: string, ref: string, signal?: AbortSignal): Promise<string | undefined> {
  if (!ref || ref.includes("\0")) throw new Error("Revision no valida.")
  const result = await git(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], signal, 1024, true)
  if (result) return result.trim()
  // An unborn branch has no commits, but is still a valid history view.
  if (ref === "HEAD") {
    const head = await git(root, ["symbolic-ref", "-q", "HEAD"], signal, 1024, true)
    if (head && !await git(root, ["show-ref", "--verify", head.trim()], signal, 1024, true)) return undefined
  }
  throw new Error("No se pudo resolver la revision de Git.")
}

export async function readGitHistory(root: string, ref = "HEAD", skip = 0, pageSize = GIT_HISTORY_PAGE_SIZE, signal?: AbortSignal): Promise<GitHistoryPage> {
  if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("Pagina de historial no valida.")
  const revision = await resolveCommit(root, ref, signal)
  if (!revision) return { commits: [], hasMore: false }
  const output = await git(root, ["log", "--no-show-signature", "--date-order", `--skip=${skip}`, `--max-count=${pageSize + 1}`, "-z", "--format=%H%x00%an%x00%aI%x00%s", revision, "--"], signal)
  const fields = output!.split("\0")
  const commits: GitCommit[] = []
  for (let index = 0; index + 3 < fields.length; index += 4) {
    commits.push({ revision: fields[index]!, author: fields[index + 1]!, date: fields[index + 2]!, subject: fields[index + 3]! })
  }
  return { revision, commits: commits.slice(0, pageSize), hasMore: commits.length > pageSize }
}

export async function readGitBranches(root: string, signal?: AbortSignal): Promise<GitBranch[]> {
  const output = await git(root, ["for-each-ref", "--sort=refname", "--format=%(refname)%00%(objectname)%00%(HEAD)%00%(symref)", "refs/heads/", "refs/remotes/"], signal)
  return output!.split("\n").filter(Boolean).flatMap((line) => {
    const [ref, revision, head, symbolic] = line.split("\0")
    if (!ref || !revision || symbolic) return []
    const remote = ref.startsWith("refs/remotes/")
    return [{ ref, revision, name: ref.replace(/^refs\/(heads|remotes)\//, ""), remote, current: head === "*" }]
  })
}

function safePath(root: string, path: string) {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || path.split("/").some((part) => part === ".." || part === "." || part.toLowerCase() === ".git") || /^[a-z]:/i.test(path)) throw new Error("Ruta historica no valida.")
  ensureInsideRoot(root, join(root, path))
}

async function commitContext(root: string, ref: string, signal?: AbortSignal) {
  const revision = await resolveCommit(root, ref, signal)
  if (!revision) throw new Error("La rama no contiene commits.")
  const [parents, prefix] = await Promise.all([
    git(root, ["rev-list", "--parents", "-1", revision, "--"], signal, 16384),
    git(root, ["rev-parse", "--show-prefix"], signal, 16384),
  ])
  return { revision, previousRevision: parents!.trim().split(/\s+/)[1] ?? null, prefix: prefix!.replace(/\r?\n$/, "") }
}

export async function readGitCommitFiles(root: string, ref: string, signal?: AbortSignal): Promise<GitFile[]> {
  const { revision, previousRevision, prefix } = await commitContext(root, ref, signal)
  const output = await git(root, ["diff-tree", "--no-commit-id", "--no-ext-diff", "--no-textconv", "-r", "-M", "--name-status", "-z", ...(previousRevision ? [previousRevision, revision] : ["--root", revision]), "--"], signal)
  const fields = output!.split("\0")
  const files: GitFile[] = []
  for (let index = 0; index + 1 < fields.length;) {
    const code = fields[index++]!
    const before = fields[index++]!
    const after = code.startsWith("R") || code.startsWith("C") ? fields[index++]! : before
    const oldInside = before.startsWith(prefix)
    const newInside = after.startsWith(prefix)
    if (!oldInside && !newInside) continue
    const renamed = before !== after
    const status = code === "D" || !newInside ? "deleted" : code === "A" || !oldInside ? "added" : renamed ? "renamed" : "modified"
    const path = (newInside ? after : before).slice(prefix.length)
    safePath(root, path)
    const previousPath = status === "renamed" ? before.slice(prefix.length) : undefined
    if (previousPath) safePath(root, previousPath)
    files.push({ path, previousPath, status, area: "changes", additions: null, deletions: null })
  }
  return files
}

export async function readGitHistoricalDiff(root: string, ref: string, file: GitFile, signal?: AbortSignal): Promise<GitDiff> {
  safePath(root, file.path)
  if (file.previousPath !== undefined) safePath(root, file.previousPath)
  const { revision, previousRevision, prefix } = await commitContext(root, ref, signal)
  async function blob(commit: string | null, path: string): Promise<string> {
    if (!commit) return ""
    const object = `${commit}:${prefix}${path}`
    const type = await git(root, ["cat-file", "-t", object], signal, 1024)
    if (type!.trim() !== "blob") throw new Error("La ruta historica no es un archivo.")
    const size = Number((await git(root, ["cat-file", "-s", object], signal, 1024))!.trim())
    if (size > MAX_FILE_BYTES) throw new Error("El archivo supera el limite de 2 MB.")
    return (await git(root, ["cat-file", "blob", object], signal, MAX_FILE_BYTES))!
  }
  const previous = file.status === "added" ? "" : await blob(previousRevision, file.previousPath ?? file.path)
  const current = file.status === "deleted" ? "" : await blob(revision, file.path)
  return { file, previous, current, revision, previousRevision }
}
