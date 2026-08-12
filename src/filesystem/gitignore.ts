import { readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import ignore, { type Ignore } from "ignore"

export async function readGitignore(root: string): Promise<Ignore> {
  const rules = await readFile(join(root, ".gitignore"), "utf8").catch(() => "")
  return ignore().add(rules)
}

export function isIgnoredPath(root: string, path: string, directory: boolean, rules: Ignore): boolean {
  const projectPath = relative(root, path).split(sep).join("/")
  return rules.ignores(projectPath) || (directory && rules.ignores(`${projectPath}/`))
}
