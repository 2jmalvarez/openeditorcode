import { resolve } from "node:path"

export function resolveRoot(argument?: string): string {
  return resolve(argument || process.cwd())
}
