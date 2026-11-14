import { APP_VERSION } from "./version"
import { t } from "../localization"
import { resolveLaunchTarget, type LaunchTarget } from "./resolve-root"

export type CliResult = { project?: string } | { output: string; exitCode: number }

export function parseCli(args: string[]): CliResult {
  const separator = args.indexOf("--")
  const options = separator === -1 ? args : args.slice(0, separator)
  if (options.includes("-h") || options.includes("--help")) return { output: t("cli.help"), exitCode: 0 }
  if (options.includes("-v") || options.includes("-V") || options.includes("--version")) return { output: APP_VERSION, exitCode: 0 }
  const operands = separator === -1 ? args : [...options, ...args.slice(separator + 1)]
  if (options.some((value) => value.startsWith("-")) || operands.length > 1) return { output: t("cli.usage"), exitCode: 2 }
  return { project: operands[0] }
}

export function resolveCli(args: string[]): LaunchTarget | { output: string; exitCode: number } {
  const cli = parseCli(args)
  if ("output" in cli) return cli
  try {
    return resolveLaunchTarget(cli.project)
  } catch (error) {
    return { output: error instanceof Error ? error.message : t("explorer.readFailed"), exitCode: 1 }
  }
}
