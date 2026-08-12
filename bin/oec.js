#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const packages = {
  "linux-x64": "@2jmalvarez/oec-linux-x64",
  "win32-x64": "@2jmalvarez/oec-win32-x64",
}

const packageName = packages[`${process.platform}-${process.arch}`]
if (!packageName) {
  console.error(`openeditorcode does not support ${process.platform}-${process.arch}.`)
  process.exit(1)
}

function resolveExecutable() {
  try {
    return require.resolve(`${packageName}/bin/oec${process.platform === "win32" ? ".exe" : ""}`)
  } catch {
    console.error(`The ${packageName} binary was not installed. Reinstall openeditorcode and try again.`)
    process.exit(1)
  }
}

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", env })
    child.on("error", (error) => {
      console.error(`Could not start ${command}: ${error.message}`)
      resolve(1)
    })
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
}

const args = process.argv.slice(2)
const appCode = await run(resolveExecutable(), args, { ...process.env, OEC_NPM_LAUNCHER: "1" })
if (appCode !== 42) process.exit(appCode)

const npm = process.platform === "win32"
  ? { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "npm install -g openeditorcode@latest"] }
  : { command: "npm", args: ["install", "-g", "openeditorcode@latest"] }
let updateCode = await run(npm.command, npm.args)
if (updateCode !== 0) {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  updateCode = await run(npm.command, npm.args)
}
if (updateCode !== 0) process.exit(updateCode)
process.exit(await run(resolveExecutable(), args, { ...process.env, OEC_NPM_LAUNCHER: "1" }))
