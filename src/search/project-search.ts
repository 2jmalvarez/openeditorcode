import { readTextFile } from "../documents/files"
import { indexFiles, type IndexedItem } from "./file-index"

export type ProjectSearchResult = {
  path: string
  line: number
  preview: string
}

export type ProjectLineCount = { files: number; lines: number; byPath: Record<string, number> }

function lineCount(content: string): number {
  if (!content) return 0
  return content.endsWith("\n") ? content.slice(0, -1).split("\n").length : content.split("\n").length
}

export async function countProjectLines(root: string, indexedItems?: IndexedItem[]): Promise<ProjectLineCount> {
  const items = indexedItems ?? await indexFiles(root)
  let files = 0
  let lines = 0
  const byPath: Record<string, number> = {}

  for (const item of items) {
    if (item.directory) continue
    try {
      const content = await readTextFile(root, item.path)
      const fileLines = lineCount(content)
      files += 1
      lines += fileLines
      byPath[item.path] = fileLines
    } catch {
      // Skip binaries, oversized files, and files that cannot be read.
    }
  }
  return { files, lines, byPath }
}

export async function searchProjectText(root: string, query: string, limit = 100, indexedItems?: IndexedItem[]): Promise<ProjectSearchResult[]> {
  const needle = query.toLocaleLowerCase()
  if (!needle) return []
  const items = (indexedItems ?? await indexFiles(root)).filter((item) => !item.directory)
  const matches: ProjectSearchResult[] = []

  for (let offset = 0; offset < items.length && matches.length < limit; offset += 12) {
    const batch = items.slice(offset, offset + 12)
    const batchMatches = await Promise.all(batch.map(async (item) => {
      const fileMatches: ProjectSearchResult[] = []
      try {
        const lines = (await readTextFile(root, item.path)).split("\n")
        for (let index = 0; index < lines.length && fileMatches.length < limit; index += 1) {
          if (lines[index].toLocaleLowerCase().includes(needle)) {
            fileMatches.push({ path: item.path, line: index + 1, preview: lines[index].trim().slice(0, 100) })
          }
        }
      } catch {
        // Skip binaries, oversized files, and files that cannot be read.
      }
      return fileMatches
    }))
    matches.push(...batchMatches.flat().slice(0, limit - matches.length))
  }
  return matches
}
