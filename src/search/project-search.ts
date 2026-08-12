import { readTextFile } from "../documents/files"
import { indexFiles } from "./file-index"

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

export async function countProjectLines(root: string): Promise<ProjectLineCount> {
  const items = await indexFiles(root)
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

export async function searchProjectText(root: string, query: string, limit = 100): Promise<ProjectSearchResult[]> {
  const needle = query.toLocaleLowerCase()
  if (!needle) return []
  const items = await indexFiles(root)
  const matches: ProjectSearchResult[] = []

  for (const item of items) {
    if (item.directory || matches.length >= limit) continue
    try {
      const lines = (await readTextFile(root, item.path)).split("\n")
      for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
        if (lines[index].toLocaleLowerCase().includes(needle)) {
          matches.push({ path: item.path, line: index + 1, preview: lines[index].trim().slice(0, 100) })
        }
      }
    } catch {
      // Skip binaries, oversized files, and files that cannot be read.
    }
  }
  return matches
}
