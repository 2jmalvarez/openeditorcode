import { basename, isAbsolute, join, relative, resolve, sep } from "node:path"
import { readdir } from "node:fs/promises"
import { isIgnoredByScopes, readGitignore, type GitignoreScope } from "../../../../src/explorer/gitignore"
import { ensureInsideRoot, ensurePhysicallyInsideRoot, MAX_FILE_BYTES, readTextFile } from "../../../../src/documents/files"
import { parseWslPath } from "../../../../src/documents/wsl-save"
import { parseGitStatus, parseGitNumstat, type GitFile } from "../../../../src/git/status"

export type Change = GitFile & { file: string; repositoryRoot?: string }
export type LocalRepository = { id: string; root: string; name: string; branch: string; error?: string }
export type LocalChanges = { repository: boolean; files: Change[]; repositories?: LocalRepository[]; discoveryError?: string; discoveryPending?: boolean }
export type ChangesReader = (root: string, signal: AbortSignal, rediscover?: boolean) => Promise<LocalChanges>

export function changesError(error: unknown): string {
  return error instanceof Error && error.name === "TimeoutError" ? "Git refresh timed out" : error instanceof Error ? error.message : String(error)
}

function within(root: string, path: string) {
  const rest = relative(root, path)
  return rest === "" || (!isAbsolute(rest) && rest !== ".." && !rest.startsWith(`..${sep}`))
}

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
  const abort = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10_000)])
  try {
    const child = Bun.spawn(gitCommand(root, args), { stdin: "ignore", stdout: "pipe", stderr: "pipe", windowsHide: true, env: { ...process.env, LC_ALL: "C", LANG: "C" },
      signal: abort })
    const [stdout, stderr, code] = await Promise.all([limited(child.stdout, MAX_FILE_BYTES, () => child.kill()), limited(child.stderr, 64 * 1024, () => child.kill()), child.exited])
    abort.throwIfAborted()
    return { stdout, stderr, code }
  } catch (error) {
    if (abort.aborted && abort.reason?.name === "TimeoutError") throw new Error(`Git refresh timed out · git ${args[0]} · ${root}`)
    throw error
  }
}

export function changePath(root: string, path: string): string {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) throw new Error("Invalid Git file path")
  return ensureInsideRoot(root, resolve(root, path))
}

const readRepositoryChanges = async (root: string, signal: AbortSignal, repositories: readonly string[] = []): Promise<LocalChanges> => {
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
    // Git reports embedded untracked repositories as directory entries ("repo/").
    // Remove them before validating file paths; their own reader supplies the files.
    // During incremental discovery the child may not have been reached yet.
    if (file.status === "untracked" && file.path.endsWith("/")) return []
    if (repositories.some((child) => child !== root && within(root, child) && within(child, resolve(root, file.path)))) return []
    changePath(root, file.path)
    if (file.previousPath) changePath(root, file.previousPath)
    return [{ ...file, file: file.path }]
  })
  return { repository: true, files }
}

/** Keep a bounded traversal cursor, not a deadline for the entire workspace.
 * Large/slow filesystems (including WSL) must make progress across refreshes
 * instead of restarting the same ten-second scan forever. */
export function createRepositoryDiscovery(root: string, sliceMs = 500) {
  const found = new Set<string>()
  const pending: { directory: string; scopes: GitignoreScope[] }[] = [{ directory: root, scopes: [] }]
  let visited = 0
  return { async scan(signal: AbortSignal, onRepository?: (directory: string) => void) {
    const started = performance.now()
    while (pending.length) {
      signal.throwIfAborted()
      if (visited >= 20_000) throw new Error("Repository discovery exceeds the 20,000 directory limit")
      // Leave the current directory queued until all its reads succeed. An
      // operation timeout/cancellation must not silently skip part of the tree.
      const { directory, scopes: inherited } = pending.at(-1)!
      await ensurePhysicallyInsideRoot(root, directory)
      const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
        if (directory === root) throw error
        return []
      })
      // Each repository/directory has its own ignore scope. A workspace container
      // often has no .gitignore while its child repositories ignore large outputs.
      let scopes = inherited
      if (entries.some((entry) => entry.name === ".gitignore")) {
        await ensurePhysicallyInsideRoot(root, join(directory, ".gitignore"))
        scopes = [...inherited, { root: directory, rules: await readGitignore(directory) }]
      }
      if (directory === root || entries.some((entry) => entry.name === ".git" && (entry.isDirectory() || entry.isFile()))) {
        const info = await git(directory, ["rev-parse", "--is-inside-work-tree"], signal)
        if (info.code === 0 && info.stdout.trim() === "true" && !found.has(directory)) { found.add(directory); onRepository?.(directory) }
        else if (info.code && !/not a git repository/i.test(info.stderr)) throw new Error(info.stderr.trim() || "Could not inspect local Git repository")
      }
      signal.throwIfAborted()
      pending.pop(); visited++
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === ".git" || entry.name === "node_modules") continue
        const path = join(directory, entry.name)
        if (!isIgnoredByScopes(path, true, scopes)) pending.push({ directory: path, scopes })
      }
      if (performance.now() - started >= sliceMs) break
    }
    signal.throwIfAborted()
    return { roots: [...found].sort((a, b) => a.localeCompare(b)), complete: pending.length === 0 }
  } }
}

/** One-shot callers can still request a complete, externally cancelable scan. */
export async function discoverLocalRepositories(root: string, signal: AbortSignal, onRepository?: (directory: string) => void): Promise<string[]> {
  return (await createRepositoryDiscovery(root, Number.POSITIVE_INFINITY).scan(signal, onRepository)).roots
}

async function readLocalRepository(root: string, directory: string, roots: readonly string[], signal: AbortSignal): Promise<LocalChanges> {
  const id = relative(root, directory).replace(/\\/g, "/") || "."
  const repository: LocalRepository = { id, root: directory, name: id === "." ? basename(root) : id, branch: "" }
  try {
    await ensurePhysicallyInsideRoot(root, directory)
    const [state, branch] = await Promise.all([
      readRepositoryChanges(directory, signal, roots),
      git(directory, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal),
    ])
    if (branch.code === 0) repository.branch = branch.stdout.trim()
    else {
      const head = await git(directory, ["rev-parse", "--short", "HEAD"], signal)
      if (head.code) throw new Error(head.stderr.trim() || "Could not read Git branch")
      repository.branch = `detached HEAD · ${head.stdout.trim()}`
    }
    return { repository: true, repositories: [repository], files: state.files.map((file) => ({ ...file, repositoryRoot: directory })) }
  } catch (error) {
    repository.error = changesError(signal.aborted && signal.reason?.name !== "TimeoutError" ? signal.reason : error)
  }
  return { repository: true, repositories: [repository], files: [] }
}

/** One cache per controller/root, never shared across consent boundaries. */
export function createChangesReader(options: {
  discoveryTTL?: number
  discoverySliceMs?: number
  timeoutMs?: number
  discover?: typeof discoverLocalRepositories
  readRepository?: typeof readLocalRepository
} = {}): ChangesReader {
  let cached: { root: string; roots: string[]; at: number } | undefined
  let failure: { root: string; at: number; error: string } | undefined
  let traversal: { root: string; cursor: ReturnType<typeof createRepositoryDiscovery> } | undefined
  return async (root, signal, rediscover = false) => {
    const timeout = () => AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 10_000)])
    const ttl = options.discoveryTTL ?? 30_000
    if (rediscover || failure?.root !== root || Date.now() - failure.at >= ttl) {
      if (rediscover || traversal?.root === root || !cached || cached.root !== root || Date.now() - cached.at >= ttl) {
        const discoverySignal = timeout()
        const discovered: string[] = []
        try {
          const onRepository = (directory: string) => { discovered.push(directory) }
          let roots: string[], complete = true
          if (options.discover) roots = await options.discover(root, discoverySignal, onRepository)
          else {
            if (!traversal || traversal.root !== root) traversal = { root, cursor: createRepositoryDiscovery(root, options.discoverySliceMs) }
            const result = await traversal.cursor.scan(discoverySignal, onRepository)
            roots = result.roots; complete = result.complete
          }
          discoverySignal.throwIfAborted()
          cached = { root, roots: complete ? roots : [...new Set([...(cached?.root === root ? cached.roots : []), ...roots])].sort(), at: Date.now() }
          if (complete) traversal = undefined
          failure = undefined
        } catch (error) {
          signal.throwIfAborted()
          failure = { root, at: Date.now(), error: `Repository discovery failed · ${changesError(discoverySignal.aborted ? discoverySignal.reason : error)}` }
          if (discovered.length) cached = { root, roots: [...new Set([...(cached?.root === root ? cached.roots : []), ...discovered])].sort(), at: Date.now() }
        }
      }
    }
    // A failed rescan must not prevent known repositories from refreshing or
    // trigger another expensive scan on every three-second poll.
    if (!cached || cached.root !== root) throw new Error(failure?.error ?? "Repository discovery failed")
    const roots = cached.roots
    const results: LocalChanges[] = new Array(roots.length)
    let next = 0
    // Bound subprocess pressure, but do not let one slow repository consume
    // every other repository's deadline.
    await Promise.all(Array.from({ length: Math.min(3, roots.length) }, async () => {
      while (next < roots.length) {
        signal.throwIfAborted()
        const index = next++
        results[index] = await (options.readRepository ?? readLocalRepository)(root, roots[index]!, roots, timeout())
      }
    }))
    signal.throwIfAborted()
    return { repository: roots.length > 0, repositories: results.flatMap((result) => result.repositories ?? []), files: results.flatMap((result) => result.files), discoveryError: failure?.root === root ? failure.error : undefined, discoveryPending: traversal?.root === root }
  }
}

// Direct one-shot callers do not retain a workspace cache.
export const readLocalChanges: ChangesReader = (root, signal) => createChangesReader({ discoverySliceMs: Number.POSITIVE_INFINITY })(root, signal)

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
