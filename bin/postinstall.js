import { readFileSync } from "node:fs"

if (process.env.npm_config_global === "true") {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
  const spanish = /^es(?:[-_.]|$)/i.test(locale)
  console.log(spanish
    ? `OpenEditorCode instalado en versi\u00f3n ${version}.\nPara ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.`
    : `OpenEditorCode version ${version} installed.\nTo run it, enter oec or openeditorcode inside your project folder.`)
}
