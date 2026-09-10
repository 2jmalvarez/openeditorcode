import { ensureInsideRoot, readTextFile } from "../documents/files"
import { join } from "node:path"

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked"
export type GitFileArea = "staged" | "changes"

export type GitFile = {
  /** Relative to the open workspace, not necessarily the repository root. */
  path: string
  status: GitFileStatus
  area: GitFileArea
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
  /** Immutable commit IDs; null denotes the empty tree before a root commit. */
  revision?: string
  previousRevision?: string | null
}

export type GitFailure = {
  operation: string
  exitCode?: number
  stdout: string
  stderr: string
}

export type ReportGitFailure = (failure: GitFailure) => void

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

async function runGitAsync(root: string, args: string[], operation: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  try {
    const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
    if (exitCode === 0) return true
    reportFailure?.({ operation, exitCode, stdout, stderr })
    return false
  } catch (error) {
    reportFailure?.({ operation, stdout: "", stderr: error instanceof Error ? error.stack ?? error.message : "No se pudo iniciar el proceso Git." })
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
    if (code === "!!") continue
    const hasRenamedPath = code.includes("R") || code.includes("C")
    const renamedFrom = hasRenamedPath ? entries[index + 1] : undefined
    if (hasRenamedPath) index += 1
    if (code === "??") {
      files.push({ path, status: "untracked", area: "changes", additions: null, deletions: null })
      continue
    }
    for (const [area, statusCode] of [["staged", code[0]], ["changes", code[1]]] as const) {
      if (!statusCode || statusCode === " ") continue
      const status: GitFileStatus = statusCode === "R" || statusCode === "C" ? "renamed"
        : statusCode === "D" ? "deleted"
          : statusCode === "A" ? "added"
            : "modified"
      const file = { path, status, area, additions: null, deletions: null }
      files.push(status !== "renamed" || renamedFrom === undefined ? file : { ...file, previousPath: renamedFrom })
    }
  }
  return files.sort((left, right) => Number(left.area === "changes") - Number(right.area === "changes") || left.path.localeCompare(right.path))
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

function workspacePath(root: string, path: string): string {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) throw new Error("Ruta Git fuera del workspace o no valida.")
  ensureInsideRoot(root, join(root, path))
  return path
}

export async function readGitState(root: string, signal?: AbortSignal): Promise<GitState> {
  const repository = await runGit(root, ["rev-parse", "--is-inside-work-tree"], signal)
  if (!repository.success || repository.stdout.trim() !== "true") return emptyState("Esta carpeta no es un repositorio Git.")

  const [branch, status, upstream, stagedNumstat, changesNumstat, prefixResult] = await Promise.all([
    runGit(root, ["branch", "--show-current"], signal),
    runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], signal),
    runGit(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], signal),
    runGit(root, ["diff", "--cached", "--no-relative", "--numstat", "-z", "HEAD"], signal),
    runGit(root, ["diff", "--no-relative", "--numstat", "-z"], signal),
    runGit(root, ["rev-parse", "--show-prefix"], signal),
  ])
  if (!status.success || !prefixResult.success) return emptyState("No se pudo leer el estado de Git.")
  const prefix = prefixResult.stdout.replace(/\r?\n$/, "")
  const stagedStats = stagedNumstat.success ? parseGitNumstat(stagedNumstat.stdout) : new Map()
  const changesStats = changesNumstat.success ? parseGitNumstat(changesNumstat.stdout) : new Map()
  const files = parseGitStatus(status.stdout).flatMap((file): GitFile[] => {
    const newInside = file.path.startsWith(prefix)
    const oldInside = (file.previousPath ?? file.path).startsWith(prefix)
    if (!newInside && !oldInside) return []
    const stats = (file.area === "staged" ? stagedStats : changesStats).get(file.path)
    if (stats) Object.assign(file, stats)
    // A cross-boundary rename is only an addition/deletion within this workspace.
    if (newInside !== oldInside) {
      file.path = (newInside ? file.path : file.previousPath!).slice(prefix.length)
      file.status = newInside ? "added" : "deleted"
      delete file.previousPath
      file.additions = null
      file.deletions = null
    } else {
      file.path = file.path.slice(prefix.length)
      if (file.previousPath !== undefined) file.previousPath = file.previousPath.slice(prefix.length)
    }
    workspacePath(root, file.path)
    if (file.previousPath !== undefined) workspacePath(root, file.previousPath)
    return [file]
  })
  await Promise.all(files.map(async (file) => {
    if (file.status !== "untracked") return
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

export async function fetchGit(root: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitAsync(root, ["fetch", "--quiet"], "git fetch", reportFailure)
}

export async function stageGitFile(root: string, file: GitFile, reportFailure?: ReportGitFailure): Promise<boolean> {
  return stageGitFiles(root, [file], reportFailure)
}

export async function unstageGitFile(root: string, file: GitFile, reportFailure?: ReportGitFailure): Promise<boolean> {
  return unstageGitFiles(root, [file], reportFailure)
}

export async function restoreGitFile(root: string, file: GitFile, reportFailure?: ReportGitFailure): Promise<boolean> {
  return restoreGitFiles(root, [file], reportFailure)
}

export async function stageGitFiles(root: string, files: GitFile[], reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitFiles(root, ["add"], files, "git add", reportFailure)
}

export async function unstageGitFiles(root: string, files: GitFile[], reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitFiles(root, ["restore", "--staged"], files, "git restore --staged", reportFailure)
}

export async function restoreGitFiles(root: string, files: GitFile[], reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitFiles(root, ["checkout"], files, "git checkout", reportFailure)
}

async function runGitFiles(root: string, args: string[], files: GitFile[], operation: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  if (!files.length) return false
  try {
    const paths = [...new Set(files.flatMap((file) => file.previousPath === undefined ? [file.path] : [file.path, file.previousPath]))].map((path) => workspacePath(root, path))
    return await runGitAsync(root, ["--literal-pathspecs", ...args, "--", ...paths], operation, reportFailure)
  } catch (error) {
    reportFailure?.({ operation, stdout: "", stderr: error instanceof Error ? error.message : "Ruta Git no valida." })
    return false
  }
}

export async function commitGitChanges(root: string, message: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  return Boolean(message.trim()) && runGitAsync(root, ["commit", "-m", message], "git commit", reportFailure)
}

export async function pullGit(root: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitAsync(root, ["pull"], "git pull", reportFailure)
}

export async function pushGit(root: string, reportFailure?: ReportGitFailure): Promise<boolean> {
  return runGitAsync(root, ["push"], "git push", reportFailure)
}

export async function readGitDiff(root: string, file: GitFile): Promise<GitDiff> {
  workspacePath(root, file.path)
  if (file.previousPath !== undefined) workspacePath(root, file.previousPath)
  const prefixResult = await runGit(root, ["rev-parse", "--show-prefix"])
  if (!prefixResult.success) throw new Error("No se pudo resolver la ruta del workspace en Git.")
  const prefix = prefixResult.stdout.replace(/\r?\n$/, "")
  const hasPrevious = file.status !== "added" && file.status !== "untracked"
  const previousPath = file.status === "renamed" ? file.previousPath : file.path
  if (hasPrevious && !previousPath) throw new Error("No se pudo determinar la ruta anterior del archivo.")
  const previous = hasPrevious
    ? await runGit(root, ["show", file.area === "staged" ? `HEAD:${prefix}${previousPath}` : `:${prefix}${previousPath}`])
    : { stdout: "", success: true }
  const indexed = file.status === "deleted" ? { stdout: "", success: true } : await runGit(root, ["show", `:${prefix}${file.path}`])
  const current = file.area === "staged"
    ? indexed.stdout
    : file.status === "deleted" ? "" : await readTextFile(root, join(root, file.path))
  if (file.area === "staged" && !indexed.success) throw new Error("No se pudo leer la versión preparada del archivo.")
  if (!previous.success) throw new Error("No se pudo leer la versión anterior del archivo.")
  return { file, previous: previous.stdout, current }
}
