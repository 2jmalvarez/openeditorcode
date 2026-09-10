import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { version } from "../package.json"

function installMessage(env) {
  return spawnSync("node", [fileURLToPath(new URL("../bin/postinstall.js", import.meta.url))], {
    encoding: "utf8",
    env: { ...process.env, npm_config_global: "true", LC_ALL: "", LC_MESSAGES: "", LANG: "", ...env },
  })
}

test("global install prints the package version and both commands in Spanish", () => {
  const result = installMessage({ LANG: "es_AR.UTF-8" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  expect(result.stdout.trim()).toBe(`OpenEditorCode instalado en versi\u00f3n ${version}.\nPara ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.`)
})

test("install locale precedence and English fallback", () => {
  for (const env of [{ LANG: "es_ES", LC_ALL: "en_US" }, { LANG: "es_ES", LC_MESSAGES: "en_GB" }, { LANG: "fr_FR" }]) {
    const result = installMessage(env)
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(`OpenEditorCode version ${version} installed.\nTo run it, enter oec or openeditorcode inside your project folder.`)
  }
})

test("local installs do not print a global installation notice", () => {
  for (const npm_config_global of ["", "false"]) {
    const result = installMessage({ npm_config_global })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("")
  }
})
