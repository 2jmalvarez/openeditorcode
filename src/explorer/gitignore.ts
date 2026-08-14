import { readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import ignore, { type Ignore } from "ignore"

export async function readGitignore(root: string): Promise<Ignore> {
  return createGitignore(parseGitignore(await readGitignoreText(root)))
}

export async function readGitignoreText(root: string): Promise<string> {
  return readFile(join(root, ".gitignore"), "utf8").catch(() => "")
}

export function parseGitignore(value: string): string[] {
  return value.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"))
}

export function createGitignore(patterns: string[]): Ignore {
  return ignore().add(patterns)
}

export function isIgnoredPath(root: string, path: string, directory: boolean, rules: Ignore): boolean {
  const projectPath = relative(root, path).split(sep).join("/")
  return rules.ignores(projectPath) || (directory && rules.ignores(`${projectPath}/`))
}
