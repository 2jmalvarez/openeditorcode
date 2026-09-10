import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Run with Bun on Windows or Node >= 22.18 on Linux. Keep all evidence in the supplied temp parent.
const parent = process.argv[2]
if (!parent || !existsSync(parent)) throw new Error("Usage: bun scripts/npm-install-smoke.ts <existing-temp-parent>")
const evidence = mkdtempSync(join(resolve(parent), `oec-npm-${process.platform}-`))
console.log(`Evidence: ${evidence}`)
const root = fileURLToPath(new URL("../", import.meta.url))
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)))
for (const name of ["user", "global"]) writeFileSync(join(evidence, `${name}.npmrc`), "")
Object.assign(env, {
  npm_config_userconfig: join(evidence, "user.npmrc"),
  npm_config_globalconfig: join(evidence, "global.npmrc"),
  npm_config_cache: join(evidence, "pack-cache"),
  npm_config_prefix: join(evidence, "pack-prefix"),
  npm_config_offline: "true",
  npm_config_update_notifier: "false",
  npm_config_ignore_scripts: "false",
})

function npm(label: string, args: string[], overrides: Record<string, string> = {}, cwd = evidence) {
  const options = { cwd, env: { ...env, ...overrides }, timeout: 120_000 }
  const result = process.platform === "win32"
    ? Bun.spawnSync(["npm.cmd", ...args], { ...options, stdout: "pipe", stderr: "pipe" })
    : spawnSync("npm", args, { ...options, encoding: "utf8" })
  const stdout = result.stdout?.toString() ?? ""
  const stderr = result.stderr?.toString() ?? ""
  const code = "exitCode" in result ? result.exitCode : result.status
  writeFileSync(join(evidence, `${label}.stdout.txt`), stdout)
  writeFileSync(join(evidence, `${label}.stderr.txt`), stderr)
  writeFileSync(join(evidence, `${label}.json`), JSON.stringify({ command: ["npm", ...args], cwd, overrides, code, stdout, stderr }, null, 2))
  console.log(`${label}: exit=${code}`)
  if (code !== 0) throw new Error(`${label} failed: ${stderr}\n${stdout}`)
  return { stdout, stderr, code }
}

const npmVersion = npm("npm-version", ["--version"]).stdout.trim()
const packed = JSON.parse(npm("pack", ["pack", root, "--pack-destination", evidence, "--json", "--offline", "--ignore-scripts"]).stdout)[0]
if (!packed.files.some((file: { path: string }) => file.path === "bin/postinstall.js")) throw new Error("Tarball missing postinstall")
const tarball = join(evidence, packed.filename)
const rows: { label: string; code: number | null; postinstallSucceeded: boolean; visibleStdout: boolean; visibleStderr: boolean }[] = []
for (const locale of [
  { name: "lang-es", LANG: "es_AR.UTF-8", LC_ALL: "", LC_MESSAGES: "", spanish: true },
  { name: "lc-all-en", LANG: "es_AR.UTF-8", LC_ALL: "en_US.UTF-8", LC_MESSAGES: "es_AR.UTF-8", spanish: false },
  { name: "lc-all-es", LANG: "en_US.UTF-8", LC_ALL: "es_AR.UTF-8", LC_MESSAGES: "en_US.UTF-8", spanish: true },
]) {
  for (const foreground of [false, true]) {
    const label = `${locale.name}-${foreground ? "foreground" : "default"}`
    const prefix = join(evidence, label)
    const cache = join(evidence, `${label}-cache`)
    mkdirSync(prefix)
    const args = ["install", "-g", tarball, "--prefix", prefix, "--omit=optional", "--no-audit", "--no-fund", "--offline"]
    if (foreground) args.push("--foreground-scripts")
    const result = npm(label, args, { LANG: locale.LANG, LC_ALL: locale.LC_ALL, LC_MESSAGES: locale.LC_MESSAGES, npm_config_cache: cache })
    const modules = join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules")
    const installed = JSON.parse(readFileSync(join(modules, manifest.name, "package.json"), "utf8"))
    if (installed.version !== manifest.version || installed.scripts.postinstall !== "node bin/postinstall.js") throw new Error("Installed package mismatch")
    for (const command of ["oec", "openeditorcode"]) {
      const shim = process.platform === "win32" ? join(prefix, `${command}.cmd`) : join(prefix, "bin", command)
      if (!existsSync(shim)) throw new Error(`Missing global command: ${shim}`)
    }
    for (const base of [modules, join(modules, manifest.name, "node_modules")]) {
      for (const dependency of Object.keys(manifest.optionalDependencies)) {
        if (existsSync(join(base, dependency))) throw new Error(`Optional package installed: ${dependency}`)
      }
    }
    const logs = readdirSync(join(cache, "_logs")).filter(name => name.endsWith(".log"))
      .map(name => readFileSync(join(cache, "_logs", name), "utf8")).join("\n")
    writeFileSync(join(evidence, `${label}.npm-debug.txt`), logs)
    if (!/info run openeditorcode@[^\n]+ postinstall[^\n]+code: 0/.test(logs)) throw new Error(`No successful postinstall in ${label} debug log`)
    const expected = locale.spanish
      ? `OpenEditorCode instalado en versi\u00f3n ${manifest.version}.\nPara ejecutarlo, ingrese oec o openeditorcode dentro de la carpeta de su proyecto.`
      : `OpenEditorCode version ${manifest.version} installed.\nTo run it, enter oec or openeditorcode inside your project folder.`
    const visibleStdout = result.stdout.replace(/\r\n/g, "\n").includes(expected)
    const visibleStderr = result.stderr.replace(/\r\n/g, "\n").includes(expected)
    if (foreground && !visibleStdout) throw new Error(`Missing expected foreground message: ${label}`)
    rows.push({ label, code: result.code, postinstallSucceeded: true, visibleStdout, visibleStderr })
  }
}
const nodeVersion = spawnSync("node", ["--version"], { encoding: "utf8" })
if (nodeVersion.status !== 0) throw new Error("Cannot determine native Node version")
const summary = { platform: process.platform, node: nodeVersion.stdout.trim(), npm: npmVersion, package: `${manifest.name}@${manifest.version}`, evidence, rows }
writeFileSync(join(evidence, "summary.json"), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
