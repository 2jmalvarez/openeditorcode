import { readTextFile } from "../documents/files"
import { join } from "node:path"

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked"

export type GitFile = {
  path: string
  status: GitFileStatus
}

export type GitState = {
  available: boolean
  branch: string
  remoteStatus: string
  files: GitFile[]
  message: string
}

export type GitDiff = {
  file: GitFile
  previous: string
  current: string
}

const emptyState = (message: string): GitState => ({ available: false, branch: "", remoteStatus: "", files: [], message })

async function runGit(root: string, args: string[]): Promise<{ stdout: string; success: boolean }> {
  try {
    const process = Bun.spawnSync(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
    return { stdout: new TextDecoder().decode(process.stdout), success: process.exitCode === 0 }
  } catch {
    return { stdout: "", success: false }
  }
}

async function runGitAsync(root: string, args: string[]): Promise<boolean> {
  try {
    const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "ignore", stderr: "pipe" })
    return await process.exited === 0
  } catch {
    return false
  }
}

export function parseGitStatus(output: string): GitFile[] {
  const files: GitFile[] = []
  const entries = output.split("\0")
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (!entry || entry.length < 4) continue
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (["R", "C"].some((kind) => code.includes(kind))) index += 1
    const status: GitFileStatus = code === "??" ? "untracked"
      : code.includes("R") || code.includes("C") ? "renamed"
        : code.includes("D") ? "deleted"
          : code.includes("A") ? "added"
            : "modified"
    files.push({ path, status })
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export async function readGitState(root: string): Promise<GitState> {
  const repository = await runGit(root, ["rev-parse", "--is-inside-work-tree"])
  if (!repository.success || repository.stdout.trim() !== "true") return emptyState("Esta carpeta no es un repositorio Git.")

  const [branch, status, upstream] = await Promise.all([
    runGit(root, ["branch", "--show-current"]),
    runGit(root, ["status", "--porcelain=v1", "-z"]),
    runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]),
  ])
  if (!status.success) return emptyState("No se pudo leer el estado de Git.")
  const remoteStatus = !upstream.success ? "sin remoto" : await remoteSummary(root)
  return { available: true, branch: branch.stdout.trim() || "HEAD separado", remoteStatus, files: parseGitStatus(status.stdout), message: "Sin cambios locales." }
}

async function remoteSummary(root: string): Promise<string> {
  const counts = await runGit(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
  if (!counts.success) return "sin remoto"
  const [ahead = 0, behind = 0] = counts.stdout.trim().split(/\s+/).map(Number)
  if (ahead && behind) return `${ahead} adelante, ${behind} atrás`
  if (ahead) return `${ahead} adelante`
  if (behind) return `${behind} atrás`
  return "actualizado"
}

export async function fetchGit(root: string): Promise<boolean> {
  return runGitAsync(root, ["fetch", "--quiet"])
}

export async function readGitDiff(root: string, file: GitFile): Promise<GitDiff> {
  const previous = file.status === "untracked" ? { stdout: "", success: true } : await runGit(root, ["show", `HEAD:${file.path}`])
  const current = file.status === "deleted" ? "" : await readTextFile(root, join(root, file.path))
  if (file.status !== "untracked" && !previous.success) throw new Error("No se pudo leer la versión anterior del archivo.")
  return { file, previous: previous.stdout, current }
}
