import { accessSync, constants, realpathSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { t } from "../localization"

export type LaunchTarget = { root: string; initialFile?: string }

export function resolveLaunchTarget(argument?: string): LaunchTarget {
  const path = resolve(argument || process.cwd())
  const info = statSync(path)
  accessSync(path, constants.R_OK)
  if (info.isDirectory()) return { root: path }
  if (!info.isFile()) throw new Error(t("files.notFile"))
  // Keep the selected file inside its physical parent, including symlink targets.
  const initialFile = realpathSync(path)
  return { root: dirname(initialFile), initialFile }
}

export function resolveRoot(argument?: string): string {
  return resolveLaunchTarget(argument).root
}
