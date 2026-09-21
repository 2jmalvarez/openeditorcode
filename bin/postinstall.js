import { chmodSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export function restoreLinuxExecutable({
  platform = process.platform,
  resolve = require.resolve,
  chmod = chmodSync,
} = {}) {
  if (platform !== "linux") return false

  try {
    chmod(resolve("@2jmalvarez/oec-linux-x64/bin/oec"), 0o755)
    return true
  } catch {
    return false
  }
}

if (process.env.npm_config_global === "true") {
  restoreLinuxExecutable()
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
  const spanish = /^es(?:[-_.]|$)/i.test(locale)
  console.log(spanish
    ? `OpenEditorCode instalado en versi\u00f3n ${version}.\nPara ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.`
    : `OpenEditorCode version ${version} installed.\nTo run it, enter oec or openeditorcode inside your project folder.`)
}
