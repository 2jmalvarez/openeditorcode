import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { chmod, copyFile, mkdtemp, rm, stat } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, posix, win32 } from "node:path"
import { fileURLToPath } from "node:url"

const registry = "https://registry.npmjs.org/"

const packages = {
  "linux-x64": "@2jmalvarez/oec-linux-x64",
  "win32-x64": "@2jmalvarez/oec-win32-x64",
}

export function platformPackage(platform = process.platform, arch = process.arch) {
  return packages[`${platform}-${arch}`]
}

export function launcherLanguage(env = process.env) {
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
  return /^es(?:[-_.]|$)/i.test(locale) ? "es" : "en"
}

export function installationTarget(packageRoot, platform, exists = existsSync) {
  const path = platform === "win32" ? win32 : posix
  if (path.basename(packageRoot).toLowerCase() !== "openeditorcode") return
  const modules = path.dirname(packageRoot)
  if (path.basename(modules).toLowerCase() !== "node_modules") return
  const parent = path.dirname(modules)
  if (platform === "win32") return { prefix: parent, global: exists(path.join(parent, "oec.cmd")) || exists(path.join(parent, "openeditorcode.cmd")) }
  const globalPrefix = path.dirname(parent)
  const global = path.basename(parent) === "lib" && (exists(path.join(globalPrefix, "bin", "oec")) || exists(path.join(globalPrefix, "bin", "openeditorcode")))
  return { prefix: global ? globalPrefix : parent, global }
}

function npmCommand(args, platform) {
  return platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", `npm ${args.map((arg) => arg.includes(" ") ? `"${arg}"` : arg).join(" ")}`] }
    : { command: "npm", args }
}

async function commandOutput(command, args, env, timeout = 30_000) {
  const child = spawn(command, args, { env, timeout, stdio: ["ignore", "pipe", "inherit"], windowsVerbatimArguments: process.platform === "win32" && /(?:^|[\\/])cmd\.exe$/i.test(command) })
  const exited = new Promise((resolve) => { child.on("error", () => resolve(1)); child.on("exit", (code) => resolve(code ?? 1)) })
  let output = ""
  for await (const chunk of child.stdout) {
    output += chunk
    if (output.length > 10_000) { child.kill(); throw new Error("unexpected output") }
  }
  if (await exited !== 0) throw new Error("command failed")
  return output.trim()
}

export function updateCommand(target, platform, version) {
  const args = ["install", ...(target.global ? ["--global"] : ["--global=false", "--no-save", "--package-lock=false"]), `openeditorcode@${version}`, `--prefix=${target.prefix}`, `--registry=${registry}`, `--@2jmalvarez:registry=${registry}`]
  return npmCommand(args, platform)
}

export function createLauncherDependencies() {
  const require = createRequire(import.meta.url)
  const packageRoot = fileURLToPath(new URL("../", import.meta.url))
  return {
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    packageRoot,
    exists: existsSync,
    readVersion: () => JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version,
    readPlatformVersion: (packageName) => JSON.parse(readFileSync(require.resolve(`${packageName}/package.json`), "utf8")).version,
    binaryVersion: (executable, env) => commandOutput(executable, ["--version"], env, 5_000),
    latestVersion: async (env) => {
      const npm = npmCommand(["view", "openeditorcode@latest", "version", `--registry=${registry}`, `--@2jmalvarez:registry=${registry}`], process.platform)
      if (process.platform === "win32") npm.command = env.ComSpec || "cmd.exe"
      return commandOutput(npm.command, npm.args, env)
    },
    resolve(packageName, platform) {
      return require.resolve(`${packageName}/bin/oec${platform === "win32" ? ".exe" : ""}`)
    },
    run(command, args, env = process.env) {
      return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: "inherit", env, windowsVerbatimArguments: process.platform === "win32" && /(?:^|[\\/])cmd\.exe$/i.test(command) })
        child.on("error", (error) => {
           console.error(launcherLanguage(env) === "es" ? `No se pudo iniciar ${command}: ${error.message}` : `Could not start ${command}: ${error.message}`)
          resolve(1)
        })
        child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)))
      })
    },
    async backup(executable, platform) {
      const directory = await mkdtemp(join(tmpdir(), "oec-update-"))
      const path = join(directory, platform === "win32" ? "oec.exe" : "oec")
      try {
        await copyFile(executable, path)
        if (platform !== "win32") await chmod(path, (await stat(executable)).mode & 0o777)
        return { path, cleanup: () => rm(directory, { recursive: true, force: true }) }
      } catch (error) {
        await rm(directory, { recursive: true, force: true })
        throw error
      }
    },
  }
}

export async function launch(args, dependencies = createLauncherDependencies()) {
  const packageName = platformPackage(dependencies.platform, dependencies.arch)
  const spanish = launcherLanguage(dependencies.env) === "es"
  if (!packageName) {
    console.error(spanish ? `openeditorcode no admite ${dependencies.platform}-${dependencies.arch}.` : `openeditorcode does not support ${dependencies.platform}-${dependencies.arch}.`)
    return 1
  }

  let executable
  try {
    executable = dependencies.resolve(packageName, dependencies.platform)
  } catch {
    console.error(spanish ? `El binario ${packageName} no está instalado. Reinstale openeditorcode e inténtelo de nuevo.` : `The ${packageName} binary was not installed. Reinstall openeditorcode and try again.`)
    return 1
  }

  const appEnv = { ...dependencies.env, OEC_NPM_LAUNCHER: "1" }
  const appCode = await dependencies.run(executable, args, appEnv)
  if (appCode !== 42) return appCode

  const target = installationTarget(dependencies.packageRoot, dependencies.platform, dependencies.exists)
  if (!target) {
    console.error(spanish ? "No se pudo identificar la instalación de OEC para actualizarla." : "Could not identify the OEC installation to update.")
    return dependencies.run(executable, args, appEnv)
  }
  let previousVersion
  let requestedVersion
  try {
    previousVersion = dependencies.readVersion()
    requestedVersion = await dependencies.latestVersion(dependencies.env)
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(requestedVersion) || requestedVersion === previousVersion) throw new Error("invalid version")
  } catch {
    console.error(spanish ? "No se pudo determinar la versión de OEC a instalar desde npm público." : "Could not determine the OEC version from the public npm registry.")
    return dependencies.run(executable, args, appEnv)
  }

  let backup
  try {
    backup = await dependencies.backup(executable, dependencies.platform)
  } catch (error) {
    console.error(spanish ? `No se pudo preparar la actualización: ${error.message}` : `Could not prepare the update: ${error.message}`)
    return dependencies.run(executable, args, appEnv)
  }

  const npm = updateCommand(target, dependencies.platform, requestedVersion)
  if (dependencies.platform === "win32") npm.command = dependencies.env.ComSpec || "cmd.exe"
  try {
    const updateCode = await dependencies.run(npm.command, npm.args, dependencies.env)
    if (updateCode !== 0) {
      console.error(spanish ? "La actualización falló. Reabriendo la versión anterior de OEC." : "Update failed. Reopening the previous version of OEC.")
      return await dependencies.run(backup.path, args, appEnv)
    }
    try {
      const version = dependencies.readVersion()
      if (version !== requestedVersion || dependencies.readPlatformVersion(packageName) !== version) throw new Error("unverified version")
      executable = dependencies.resolve(packageName, dependencies.platform)
      if (await dependencies.binaryVersion(executable, dependencies.env) !== version) throw new Error("unverified binary")
    } catch {
      console.error(spanish ? "No se pudo verificar la instalación actualizada. Reabriendo la versión anterior de OEC." : "Could not verify the updated installation. Reopening the previous version of OEC.")
      return await dependencies.run(backup.path, args, appEnv)
    }
    return await dependencies.run(executable, args, appEnv)
  } finally {
    await backup.cleanup().catch(() => undefined)
  }
}
