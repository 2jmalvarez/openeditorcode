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

let executable
try {
  executable = require.resolve(`${packageName}/bin/oec${process.platform === "win32" ? ".exe" : ""}`)
} catch {
  console.error(`The ${packageName} binary was not installed. Reinstall openeditorcode and try again.`)
  process.exit(1)
}

const child = spawn(executable, process.argv.slice(2), { stdio: "inherit" })
child.on("error", (error) => {
  console.error(`Could not start OEC: ${error.message}`)
  process.exit(1)
})
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
