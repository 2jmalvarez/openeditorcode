import { readdir } from "node:fs/promises"
import { basename, join, relative } from "node:path"
import { isIgnoredPath, readGitignore } from "../explorer/gitignore"

export type GitRepository = {
  id: string
  root: string
  workspacePath: string
  name: string
}

async function isRepository(path: string): Promise<boolean> {
  try {
    const process = Bun.spawn(["git", "-C", path, "rev-parse", "--is-inside-work-tree"], { stdout: "pipe", stderr: "ignore" })
    const output = await new Response(process.stdout).text()
    return await process.exited === 0 && output.trim() === "true"
  } catch {
    return false
  }
}

export async function discoverGitRepositories(workspaceRoot: string): Promise<GitRepository[]> {
  // Keep the existing behavior when the workspace itself belongs to a repository.
  if (await isRepository(workspaceRoot)) return [{ id: ".", root: workspaceRoot, workspacePath: "", name: basename(workspaceRoot) }]

  const rules = await readGitignore(workspaceRoot)
  const repositories: GitRepository[] = []
  const pending = [workspaceRoot]
  while (pending.length) {
    const directory = pending.pop()!
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".git" || entry.name === "node_modules") continue
      const path = join(directory, entry.name)
      if (isIgnoredPath(workspaceRoot, path, true, rules)) continue
      const gitEntry = await readdir(path, { withFileTypes: true }).then((children) => children.find((child) => child.name === ".git")).catch(() => undefined)
      if (gitEntry && await isRepository(path)) {
        const workspacePath = relative(workspaceRoot, path).replace(/\\/g, "/")
        repositories.push({ id: workspacePath, root: path, workspacePath, name: workspacePath })
        continue
      }
      pending.push(path)
    }
  }
  return repositories.sort((left, right) => left.workspacePath.localeCompare(right.workspacePath))
}
