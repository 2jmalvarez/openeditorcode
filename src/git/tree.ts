import type { GitFile } from "./status"

export type GitTreeItem = {
  path: string
  name: string
  depth: number
  directory: boolean
  expanded: boolean
  file?: GitFile
}

type Node = { name: string; path: string; children: Map<string, Node>; file?: GitFile }

export function createGitTree(files: GitFile[], expanded: Set<string>): GitTreeItem[] {
  const root: Node = { name: "", path: "", children: new Map() }
  for (const file of files) {
    let node = root
    const parts = file.path.replace(/\\/g, "/").split("/")
    for (let index = 0; index < parts.length; index += 1) {
      const path = parts.slice(0, index + 1).join("/")
      const child = node.children.get(parts[index]) ?? { name: parts[index], path, children: new Map() }
      node.children.set(parts[index], child)
      node = child
    }
    node.file = file
  }

  const output: GitTreeItem[] = []
  function visit(node: Node, depth: number) {
    const children = [...node.children.values()].sort((left, right) => Number(!left.children.size) - Number(!right.children.size) || left.name.localeCompare(right.name))
    for (const child of children) {
      const directory = child.children.size > 0
      const isExpanded = expanded.has(child.path)
      output.push({ path: child.path, name: child.name, depth, directory, expanded: isExpanded, file: child.file })
      if (directory && isExpanded) visit(child, depth + 1)
    }
  }
  visit(root, 0)
  return output
}
