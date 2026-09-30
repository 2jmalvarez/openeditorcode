import { expect, test } from "bun:test"
import { spawn, spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { installationTarget, updateCommand } from "../bin/launcher.js"

async function registry(respond) {
  const requests = []
  const server = createServer((request, response) => {
    requests.push(request.url)
    respond(response)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return { url: `http://127.0.0.1:${server.address().port}/`, requests, close: () => new Promise((resolve) => server.close(resolve)) }
}

function npmView(url, env, cwd) {
  const args = ["view", "openeditorcode@latest", "version", ...(url ? [`--registry=${url}`] : []), "--fetch-retries=0", "--offline=false"]
  const command = process.platform === "win32"
    ? { file: "cmd.exe", args: ["/d", "/s", "/c", `npm ${args.join(" ")}`], windowsVerbatimArguments: true }
    : { file: "npm", args }
  return new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsVerbatimArguments: command.windowsVerbatimArguments })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

test("a legacy npm lookup hits the private registry, while an explicit registry reaches the public target", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-registry-test-"))
  const privateRegistry = await registry((response) => { response.writeHead(404); response.end(JSON.stringify({ error: "Not found" })) })
  const publicRegistry = await registry((response) => {
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify({ name: "openeditorcode", "dist-tags": { latest: "1.0.1" }, versions: { "1.0.1": { name: "openeditorcode", version: "1.0.1" } } }))
  })
  try {
    const config = join(root, "user.npmrc")
    await writeFile(config, `registry=${privateRegistry.url}\n`)
    const env = { ...process.env, npm_config_userconfig: config, npm_config_cache: join(root, "cache"), npm_config_update_notifier: "false", npm_config_offline: "false" }
    const legacy = await npmView(undefined, env, root)
    expect(legacy.code).not.toBe(0)
    expect(privateRegistry.requests.some((request) => request?.includes("openeditorcode"))).toBe(true)
    const updated = await npmView(publicRegistry.url, env, root)
    expect(updated.code).toBe(0)
    expect(updated.stdout.trim()).toBe("1.0.1")
    expect(publicRegistry.requests.some((request) => request?.includes("openeditorcode"))).toBe(true)
  } finally {
    await Promise.all([privateRegistry.close(), publicRegistry.close()])
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

function npm(command, env, cwd) {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], { cwd, env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 90_000 })
    : spawnSync("npm", command, { cwd, env, encoding: "utf8", timeout: 90_000 })
  if (result.status !== 0) throw new Error(`${result.error ?? ""}\n${result.stderr}\n${result.stdout}`)
  return result.stdout
}

function install(target, tarball, env, cwd) {
  const command = updateCommand(target, process.platform, "1.0.1")
  if (process.platform === "win32") {
    npm(command.args[3].replace("openeditorcode@1.0.1", `"${tarball}"`), env, cwd)
  } else {
    npm(command.args.map((arg) => arg === "openeditorcode@1.0.1" ? tarball : arg), env, cwd)
  }
}

test("npm updates only the active global or local prefix under a private registry configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-update-integration-"))
  try {
    const userconfig = join(root, "user.npmrc")
    await writeFile(userconfig, "registry=https://npm.registry.example.test/\n@2jmalvarez:registry=https://npm.registry.example.test/\nglobal=true\n")
    const env = { ...process.env, npm_config_userconfig: userconfig, npm_config_registry: "https://npm.registry.example.test/", npm_config_global: "true", npm_config_prefix: join(root, "wrong-prefix"), npm_config_cache: join(root, "cache"), npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false" }
    const archives = []
    for (const version of ["0.2.32", "0.2.36"]) {
      const fixture = join(root, `fixture-${version}`)
      await mkdir(fixture)
      await writeFile(join(fixture, "package.json"), JSON.stringify({ name: "openeditorcode", version, bin: { oec: "bin/oec.js" } }))
      await mkdir(join(fixture, "bin"))
      await writeFile(join(fixture, "bin", "oec.js"), `#!/usr/bin/env node\nconsole.log(${JSON.stringify(version)})\n`)
      const result = npm(process.platform === "win32" ? `npm pack "${fixture}" --pack-destination "${root}" --ignore-scripts --offline --json` : ["pack", fixture, "--pack-destination", root, "--ignore-scripts", "--offline", "--json"], env, root)
      archives.push(join(root, JSON.parse(result)[0].filename))
    }

    const wrongPrefix = join(root, "wrong-prefix")
    await mkdir(wrongPrefix)
    install({ prefix: wrongPrefix, global: true }, archives[0], env, root)

    for (const global of [true, false]) {
      const prefix = global ? join(root, "home", "user", ".nvm", "versions", "node", "v22.23.2") : join(root, "local project")
      await mkdir(prefix, { recursive: true })
      if (!global) await writeFile(join(prefix, "package.json"), '{"name":"local-project","version":"1.0.0"}')
      const packageRoot = global
        ? join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules", "openeditorcode")
        : join(prefix, "node_modules", "openeditorcode")
      const target = { prefix, global }
      install(target, archives[0], env, root)
      expect(JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version).toBe("0.2.32")
      install(target, archives[1], env, root)
      expect(JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version).toBe("0.2.36")
      const resolved = installationTarget(packageRoot, process.platform)
      expect(resolved).toEqual(target)
      if (global && process.platform !== "win32") {
        const entry = await realpath(join(prefix, "bin", "oec"))
        const suffix = "/lib/node_modules/openeditorcode/bin/oec.js"
        expect(entry).toBe(join(packageRoot, "bin", "oec.js"))
        expect(entry.endsWith(suffix) && entry.slice(0, -suffix.length)).toBe(prefix)
      }
      if (!global) expect(JSON.parse(await readFile(join(prefix, "package.json"), "utf8")).name).toBe("local-project")
    }
    const wrongPackage = join(wrongPrefix, process.platform === "win32" ? "node_modules" : "lib/node_modules", "openeditorcode", "package.json")
    expect(JSON.parse(await readFile(wrongPackage, "utf8")).version).toBe("0.2.32")
  } finally { await rm(root, { recursive: true, force: true }) }
}, 120_000)
