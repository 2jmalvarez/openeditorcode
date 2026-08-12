import { spawn } from "node:child_process"
import { createRequire } from "node:module"

const packages = {
  "linux-x64": "@2jmalvarez/oec-linux-x64",
  "win32-x64": "@2jmalvarez/oec-win32-x64",
}

export function platformPackage(platform = process.platform, arch = process.arch) {
  return packages[`${platform}-${arch}`]
}

export function createLauncherDependencies() {
  const require = createRequire(import.meta.url)
  return {
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    resolve(packageName, platform) {
      return require.resolve(`${packageName}/bin/oec${platform === "win32" ? ".exe" : ""}`)
    },
    run(command, args, env = process.env) {
      return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: "inherit", env })
        child.on("error", (error) => {
          console.error(`Could not start ${command}: ${error.message}`)
          resolve(1)
        })
        child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)))
      })
    },
    wait(milliseconds) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds))
    },
  }
}

export async function launch(args, dependencies = createLauncherDependencies()) {
  const packageName = platformPackage(dependencies.platform, dependencies.arch)
  if (!packageName) {
    console.error(`openeditorcode does not support ${dependencies.platform}-${dependencies.arch}.`)
    return 1
  }

  let executable
  try {
    executable = dependencies.resolve(packageName, dependencies.platform)
  } catch {
    console.error(`The ${packageName} binary was not installed. Reinstall openeditorcode and try again.`)
    return 1
  }

  const appEnv = { ...dependencies.env, OEC_NPM_LAUNCHER: "1" }
  const appCode = await dependencies.run(executable, args, appEnv)
  if (appCode !== 42) return appCode

  const npm = dependencies.platform === "win32"
    ? { command: dependencies.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "npm install -g openeditorcode@latest"] }
    : { command: "npm", args: ["install", "-g", "openeditorcode@latest"] }
  let updateCode = await dependencies.run(npm.command, npm.args)
  if (updateCode !== 0) {
    await dependencies.wait(1000)
    updateCode = await dependencies.run(npm.command, npm.args)
  }
  if (updateCode !== 0) return updateCode

  try {
    executable = dependencies.resolve(packageName, dependencies.platform)
  } catch {
    return 1
  }
  return dependencies.run(executable, args, appEnv)
}
