import { extname } from "node:path"
import { format as prettierFormat } from "prettier"
import type { OecConfig } from "../config/types"

export async function formatDocument(path: string, source: string, config: OecConfig): Promise<string | undefined> {
  const extension = extname(path).toLowerCase()
  const formatter = config.editor.formatting.byExtension[extension] ?? config.editor.formatting.defaultFormatter
  if (formatter === "none") return undefined
  if (formatter === "prettier") return prettierFormat(source, { filepath: path, ...config.editor.formatting.prettier })
  const external = config.formatters.external[formatter]
  if (!external || !external.extensions.includes(extension)) return undefined
  const process = Bun.spawn([external.command, ...external.args], { stdin: new TextEncoder().encode(source), stdout: "pipe", stderr: "pipe" })
  const timeout = setTimeout(() => process.kill(), external.timeoutMs)
  try {
    const [exitCode, output, error] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()])
    if (exitCode !== 0) throw new Error(error.trim() || `El formateador ${formatter} finalizó con código ${exitCode}.`)
    return output
  } finally { clearTimeout(timeout) }
}
