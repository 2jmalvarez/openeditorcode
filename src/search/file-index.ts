import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { isIgnoredPath, readGitignore } from "../explorer/gitignore"
import { displayPath, type TreeItem } from "../explorer/tree"

export const SEARCH_LIMIT = 2000

export function fuzzyScore(query: string, candidate: string): number | undefined {
  const needle = query.toLocaleLowerCase()
  const haystack = candidate.toLocaleLowerCase()
  let cursor = 0
  let score = 0

  for (const character of needle) {
    const index = haystack.indexOf(character, cursor)
    if (index === -1) return undefined
    score += index === cursor ? 8 : Math.max(1, 4 - (index - cursor))
    cursor = index + 1
  }
  return score - haystack.length * 0.01
}

export function filterItems(root: string, items: TreeItem[], query: string, limit = 80): TreeItem[] {
  if (!query.trim()) return items.slice(0, limit)
  return items
    .map((item) => ({ item, score: fuzzyScore(query, displayPath(root, item.path)) }))
    .filter((entry): entry is { item: TreeItem; score: number } => entry.score !== undefined)
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
    .slice(0, limit)
    .map((entry) => entry.item)
}

export async function indexFiles(root: string): Promise<TreeItem[]> {
  const output: TreeItem[] = []
  const rules = await readGitignore(root)
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (output.length >= SEARCH_LIMIT) return
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      if (output.length >= SEARCH_LIMIT || entry.name === ".git") continue
      const path = join(directory, entry.name)
      const directoryEntry = entry.isDirectory()
      if (isIgnoredPath(root, path, directoryEntry, rules)) continue
      output.push({ path, name: entry.name, depth, directory: directoryEntry, ignored: false })
      if (directoryEntry) await visit(path, depth + 1)
    }
  }
  await visit(root, 0)
  return output
}

export function relativeResult(root: string, item: TreeItem): string {
  return relative(root, item.path) || "."
}
