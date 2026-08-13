import { readTextFile } from "../documents/files"
import { join } from "node:path"

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked"

export type GitFile = {
  path: string
  status: GitFileStatus
  previousPath?: string
  additions: number | null
  deletions: number | null
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

async function runGit(root: string, args: string[], signal?: AbortSignal): Promise<{ stdout: string; success: boolean }> {
  try {
    const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "ignore", signal })
    const stdout = await new Response(process.stdout).text()
    return { stdout, success: await process.exited === 0 }
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
    const renamed = code.includes("R") || code.includes("C")
    const previousPath = renamed ? entries[index + 1] : undefined
    if (renamed) index += 1
    const status: GitFileStatus = code === "??" ? "untracked"
      : renamed ? "renamed"
        : code.includes("D") ? "deleted"
          : code.includes("A") ? "added"
            : "modified"
    const file = { path, status, additions: null, deletions: null }
    files.push(previousPath === undefined ? file : { ...file, previousPath })
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export function parseGitNumstat(output: string): Map<string, { additions: number | null; deletions: number | null }> {
  const stats = new Map<string, { additions: number | null; deletions: number | null }>()
  const entries = output.split("\0")
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const firstTab = entry.indexOf("\t")
    const secondTab = entry.indexOf("\t", firstTab + 1)
    if (firstTab < 1 || secondTab < 0) continue

    const additionsText = entry.slice(0, firstTab)
    const deletionsText = entry.slice(firstTab + 1, secondTab)
    let path = entry.slice(secondTab + 1)
    if (path === "") {
      // With -z, renames store old and new paths in the following two records.
      if (index + 2 >= entries.length) continue
      path = entries[index + 2]
      index += 2
    }
    if (!path) continue

    if (additionsText !== "-" && !/^\d+$/.test(additionsText)) continue
    if (deletionsText !== "-" && !/^\d+$/.test(deletionsText)) continue
    const additions = additionsText === "-" ? null : Number(additionsText)
    const deletions = deletionsText === "-" ? null : Number(deletionsText)
    stats.set(path, { additions, deletions })
  }
  return stats
}

function countLines(content: string): number {
  if (content.length === 0) return 0
  return content.split("\n").length - Number(content.endsWith("\n"))
}

export async function readGitState(root: string, signal?: AbortSignal): Promise<GitState> {
  const repository = await runGit(root, ["rev-parse", "--is-inside-work-tree"], signal)
  if (!repository.success || repository.stdout.trim() !== "true") return emptyState("Esta carpeta no es un repositorio Git.")

  const [branch, status, upstream, numstat] = await Promise.all([
    runGit(root, ["branch", "--show-current"], signal),
    runGit(root, ["status", "--porcelain=v1", "-z"], signal),
    runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], signal),
    runGit(root, ["diff", "--numstat", "-z", "HEAD"], signal),
  ])
  if (!status.success) return emptyState("No se pudo leer el estado de Git.")
  const files = parseGitStatus(status.stdout)
  const trackedStats = numstat.success ? parseGitNumstat(numstat.stdout) : new Map()
  await Promise.all(files.map(async (file) => {
    if (file.status !== "untracked") {
      const stats = trackedStats.get(file.path)
      if (stats) Object.assign(file, stats)
      return
    }
    try {
      file.additions = countLines(await readTextFile(root, join(root, file.path)))
      file.deletions = 0
    } catch {
      file.additions = null
      file.deletions = null
    }
  }))
  const remoteStatus = !upstream.success ? "sin remoto" : await remoteSummary(root, signal)
  return { available: true, branch: branch.stdout.trim() || "HEAD separado", remoteStatus, files, message: "Sin cambios locales." }
}

async function remoteSummary(root: string, signal?: AbortSignal): Promise<string> {
  const counts = await runGit(root, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], signal)
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
  const hasPrevious = file.status !== "added" && file.status !== "untracked"
  const previousPath = file.status === "renamed" ? file.previousPath : file.path
  if (hasPrevious && !previousPath) throw new Error("No se pudo determinar la ruta anterior del archivo.")
  const previous = hasPrevious ? await runGit(root, ["show", `HEAD:${previousPath}`]) : { stdout: "", success: true }
  const current = file.status === "deleted" ? "" : await readTextFile(root, join(root, file.path))
  if (!previous.success) throw new Error("No se pudo leer la versión anterior del archivo.")
  return { file, previous: previous.stdout, current }
}
