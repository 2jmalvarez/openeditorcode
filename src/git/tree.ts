import type { GitFile, GitFileArea } from "./status"

export type GitTreeItem = {
  path: string
  name: string
  depth: number
  directory: boolean
  expanded: boolean
  file?: GitFile
  fileNumber?: number
}

type Node = { name: string; path: string; children: Map<string, Node>; file?: GitFile; fileNumber?: number }

export function createGitTree(files: GitFile[], expanded: Set<string>): GitTreeItem[] {
  const roots = new Map<GitFileArea, Node>()
  for (const [fileIndex, file] of files.entries()) {
    const root = roots.get(file.area) ?? { name: file.area === "staged" ? "STAGED" : "CAMBIOS", path: file.area, children: new Map() }
    roots.set(file.area, root)
    let node: Node = root
    const parts = file.path.replace(/\\/g, "/").split("/")
    for (let index = 0; index < parts.length; index += 1) {
      const path = `${file.area}/${parts.slice(0, index + 1).join("/")}`
      const child = node.children.get(parts[index]) ?? { name: parts[index], path, children: new Map() }
      node.children.set(parts[index], child)
      node = child
    }
    node.file = file
    node.fileNumber = fileIndex + 1
  }

  const output: GitTreeItem[] = []
  function visit(node: Node, depth: number) {
    const children = [...node.children.values()].sort((left, right) => Number(!left.children.size) - Number(!right.children.size) || left.name.localeCompare(right.name))
    for (const child of children) {
      const directory = child.children.size > 0
      const isExpanded = expanded.has(child.path)
      output.push({ path: child.path, name: child.name, depth, directory, expanded: isExpanded, file: child.file, fileNumber: child.fileNumber })
      if (directory && isExpanded) visit(child, depth + 1)
    }
  }
  for (const area of ["staged", "changes"] as const) {
    const root = roots.get(area)
    if (!root) continue
    const isExpanded = expanded.has(root.path)
    output.push({ path: root.path, name: `${root.name} ${files.filter((file) => file.area === area).length}`, depth: 0, directory: true, expanded: isExpanded })
    if (isExpanded) visit(root, 1)
  }
  return output
}
