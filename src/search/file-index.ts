import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { isIgnoredPath, readGitignore } from "../explorer/gitignore"

export const SEARCH_LIMIT = 50_000

export type IndexedItem = { path: string; name: string; directory: boolean }
export type FileIndex = { items: IndexedItem[]; truncated: boolean }
export type BuildFileIndexOptions = { limit?: number }

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

export function filterItems<T extends IndexedItem>(root: string, items: T[], query: string, limit = 80): T[] {
  if (!query.trim()) return items.slice(0, limit)
  return items
    .map((item) => ({ item, score: fuzzyScore(query, relative(root, item.path) || ".") }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== undefined)
    .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
    .slice(0, limit)
    .map((entry) => entry.item)
}

export async function buildFileIndex(root: string, options: BuildFileIndexOptions = {}): Promise<FileIndex> {
  const limit = options.limit ?? SEARCH_LIMIT
  const output: IndexedItem[] = []
  const rules = await readGitignore(root)
  const pending = [{ path: root, depth: 0 }]

  while (pending.length && output.length < limit) {
    const directories = pending.splice(0, 16)
    const batches = await Promise.all(directories.map(async (directory) => ({
      directory,
      entries: await readdir(directory.path, { withFileTypes: true }).catch(() => []),
    })))
    for (const { directory, entries } of batches) {
      entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
      for (const entry of entries) {
        if (output.length >= limit || entry.name === ".git") continue
        const path = join(directory.path, entry.name)
        const directoryEntry = entry.isDirectory()
        if (isIgnoredPath(root, path, directoryEntry, rules)) continue
        output.push({ path, name: entry.name, directory: directoryEntry })
        if (directoryEntry) pending.push({ path, depth: directory.depth + 1 })
      }
    }
  }
  const items = output.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  return { items, truncated: pending.length > 0 || items.length >= limit }
}

export async function indexFiles(root: string): Promise<IndexedItem[]> {
  return (await buildFileIndex(root)).items
}

export function relativeResult(root: string, item: IndexedItem): string {
  return relative(root, item.path) || "."
}
