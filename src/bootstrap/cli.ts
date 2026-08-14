import { APP_VERSION } from "./version"
import { t } from "../localization"

export type CliResult = { project?: string } | { output: string; exitCode: number }

export function parseCli(args: string[]): CliResult {
  if (args.includes("-h") || args.includes("--help")) return { output: t("cli.help"), exitCode: 0 }
  if (args.includes("-V") || args.includes("--version")) return { output: APP_VERSION, exitCode: 0 }
  const afterSeparator = args[0] === "--"
  const operands = afterSeparator ? args.slice(1) : args
  if ((!afterSeparator && operands.some((value) => value.startsWith("-"))) || operands.length > 1) return { output: t("cli.usage"), exitCode: 2 }
  return { project: operands[0] }
}
