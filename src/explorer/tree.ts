import { readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { isIgnoredPath, readGitignore } from "./gitignore"
import type { Ignore } from "ignore"
import { t } from "../localization"

export type TreeItem = {
  path: string
  name: string
  depth: number
  directory: boolean
  expanded?: boolean
  ignored: boolean
}

export async function listDirectory(root: string, directory: string, depth: number, expanded: ReadonlySet<string>, rules: Ignore): Promise<TreeItem[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const visible = entries
    .filter((entry) => entry.name !== ".git")
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
  const items: TreeItem[] = []

  for (const entry of visible) {
    const path = join(directory, entry.name)
    const directoryEntry = entry.isDirectory()
    const isExpanded = directoryEntry && expanded.has(path)
    const ignored = isIgnoredPath(root, path, directoryEntry, rules)
    items.push({ path, name: entry.name, depth, directory: directoryEntry, expanded: isExpanded, ignored })
    if (isExpanded) items.push(...await listDirectory(root, path, depth + 1, expanded, rules))
  }
  return items
}

export async function createTree(root: string, expanded: ReadonlySet<string>): Promise<TreeItem[]> {
  const rootInfo = await stat(root)
  if (!rootInfo.isDirectory()) throw new Error(t("explorer.invalidRoot"))
  return listDirectory(root, root, 0, expanded, await readGitignore(root))
}

export async function descendantDirectories(directory: string): Promise<Set<string>> {
  const directories = new Set<string>([directory])
  const pending = [directory]
  while (pending.length) {
    const current = pending.pop()!
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === ".git" || !entry.isDirectory()) continue
      const path = join(current, entry.name)
      directories.add(path)
      pending.push(path)
    }
  }
  return directories
}

export function displayPath(root: string, itemPath: string): string {
  return relative(root, itemPath) || "."
}
