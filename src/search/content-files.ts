import { readTextFile } from "../documents/files"
import type { IndexedItem } from "./file-index"

/** Simple literal content filter: one result per file, not a list of matching lines. */
export async function filterFilesByContent(root: string, items: readonly IndexedItem[], query: string, isCurrent = () => true): Promise<IndexedItem[]> {
  if (!query.trim()) return []
  const needle = query.toLocaleLowerCase()
  const files = items.filter((item) => !item.directory)
  const results: IndexedItem[] = []
  for (let offset = 0; offset < files.length && isCurrent(); offset += 12) {
    const batch = await Promise.all(files.slice(offset, offset + 12).map(async (item) => {
      try {
        return (await readTextFile(root, item.path)).toLocaleLowerCase().includes(needle) ? item : undefined
      } catch {
        // Same safe reader as the editor: skip binaries, oversized and inaccessible files.
        return undefined
      }
    }))
    if (!isCurrent()) return []
    for (const item of batch) if (item) results.push(item)
  }
  return results
}
