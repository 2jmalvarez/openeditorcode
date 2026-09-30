import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { installationTarget, launch, launcherLanguage, updateCommand } from "../bin/launcher.js"

test("launcher chooses Spanish only for Spanish system locales", () => {
  expect(launcherLanguage({ LANG: "es_AR.UTF-8" })).toBe("es")
  expect(launcherLanguage({ LANG: "es_AR.UTF-8", LC_ALL: "en_US.UTF-8" })).toBe("en")
  expect(launcherLanguage({ LANG: "en_US.UTF-8" })).toBe("en")
})

function dependencies(codes) {
  const calls = []
  let resolutions = 0
  return {
    calls,
    get resolutions() { return resolutions },
    platform: "linux",
    arch: "x64",
    env: {},
    packageRoot: "/opt/oec/lib/node_modules/openeditorcode",
    exists: (path) => path === "/opt/oec/bin/oec",
    readVersion: () => calls.some((call) => call.command === "npm") ? "0.2.36" : "0.2.35",
    readPlatformVersion: () => "0.2.36",
    resolve() {
      resolutions += 1
      return `/bin/oec-${resolutions}`
    },
    async run(command, args, env) {
      calls.push({ command, args, env })
      return codes.shift() ?? 0
    },
    async backup(executable) {
      calls.push({ command: "backup", args: [executable] })
      return {
        path: "/tmp/oec-update/oec",
        async cleanup() { calls.push({ command: "cleanup" }) },
      }
    },
  }
}

test("launcher propagates a normal application exit", async () => {
  const deps = dependencies([7])
  expect(await launch(["project"], deps)).toBe(7)
  expect(deps.calls).toHaveLength(1)
})

test("launcher updates and resolves the application again after exit 42", async () => {
  const deps = dependencies([42, 0, 0])
  deps.env = { npm_config_registry: "https://npm.registry.example.test/", npm_config_prefix: "/another/prefix" }
  expect(await launch(["project"], deps)).toBe(0)
  expect(deps.resolutions).toBe(2)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/bin/oec-2", "cleanup"])
  expect(deps.calls[0].env.OEC_NPM_LAUNCHER).toBe("1")
  expect(deps.calls[2].args).toEqual(["install", "--global", "openeditorcode@latest", "--prefix=/opt/oec", "--registry=https://registry.npmjs.org/", "--@2jmalvarez:registry=https://registry.npmjs.org/"])
  expect(deps.calls[2].env).toEqual(deps.env)
  expect(deps.calls[3].args).toEqual(["project"])
})

test("launcher reopens the previous version when npm fails, without retrying the same registry", async () => {
  const deps = dependencies([42, 1, 0])
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/tmp/oec-update/oec", "cleanup"])
  expect(deps.resolutions).toBe(1)
})

test("launcher reopens the previous version if the updated binary is missing", async () => {
  const deps = dependencies([42, 0, 0])
  const resolve = deps.resolve
  deps.resolve = () => {
    if (deps.resolutions) throw new Error("missing package")
    return resolve()
  }
  expect(await launch(["project"], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/tmp/oec-update/oec", "cleanup"])
  expect(deps.resolutions).toBe(1)
})

test("launcher keeps the installed version when backup cannot be created", async () => {
  const deps = dependencies([42, 0])
  deps.backup = async () => { throw new Error("disk full") }
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "/bin/oec-1"])
})

test("Windows update overrides the registry for both packages", async () => {
  const deps = dependencies([42, 0, 0])
  deps.platform = "win32"
  deps.packageRoot = "C:\\Program Files\\OEC\\node_modules\\openeditorcode"
  deps.exists = (path) => path === "C:\\Program Files\\OEC\\oec.cmd"
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls[2]).toMatchObject({ command: "cmd.exe", args: ["/d", "/s", "/c", 'npm install --global openeditorcode@latest "--prefix=C:\\Program Files\\OEC" --registry=https://registry.npmjs.org/ --@2jmalvarez:registry=https://registry.npmjs.org/'] })
})

test("targets the launcher installation regardless of the working directory or npm default prefix", async () => {
  for (const packageRoot of ["/home/user/.local/lib/node_modules/openeditorcode", "/opt/custom/lib/node_modules/openeditorcode"]) {
    const deps = dependencies([42, 0, 0])
    deps.packageRoot = packageRoot
    deps.exists = (path) => path === `${packageRoot.split("/lib/")[0]}/bin/oec`
    expect(await launch([], deps)).toBe(0)
    expect(deps.calls[2].args).toContain(`--prefix=${packageRoot.split("/lib/")[0]}`)
  }
})

test("uses no-save and disables lockfile writes when updating a local installation", async () => {
  const deps = dependencies([42, 0, 0])
  deps.packageRoot = "/home/user/my project/node_modules/openeditorcode"
  deps.exists = () => false
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls[2].args).toEqual(["install", "--no-save", "--package-lock=false", "openeditorcode@latest", "--prefix=/home/user/my project", "--registry=https://registry.npmjs.org/", "--@2jmalvarez:registry=https://registry.npmjs.org/"])
})

test("does not relaunch an unchanged installed version as an update", async () => {
  const deps = dependencies([42, 0, 0])
  deps.readVersion = () => "0.2.35"
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/tmp/oec-update/oec", "cleanup"])
})

test("does not relaunch if the platform binary belongs to another version", async () => {
  const deps = dependencies([42, 0, 0])
  deps.readPlatformVersion = () => "0.2.35"
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/tmp/oec-update/oec", "cleanup"])
})

test("recognizes local and global npm layouts on both platforms", () => {
  expect(installationTarget("/tmp/project/node_modules/openeditorcode", "linux", () => false)).toEqual({ prefix: "/tmp/project", global: false })
  expect(installationTarget("/custom/lib/node_modules/openeditorcode", "linux", (path) => path === "/custom/bin/oec")).toEqual({ prefix: "/custom", global: true })
  expect(installationTarget("C:\\work\\node_modules\\openeditorcode", "win32", () => false)).toEqual({ prefix: "C:\\work", global: false })
  expect(installationTarget("C:\\Program Files\\node\\node_modules\\openeditorcode", "win32", (path) => path === "C:\\Program Files\\node\\oec.cmd")).toEqual({ prefix: "C:\\Program Files\\node", global: true })
  expect(installationTarget("/other/package", "linux", () => false)).toBeUndefined()
  expect(updateCommand({ prefix: "C:\\work space", global: false }, "win32").args[3]).toContain('"--prefix=C:\\work space"')
})

test.skipIf(process.platform !== "win32")("passes a spaced Windows prefix as one argument through cmd.exe", () => {
  const invocation = updateCommand({ prefix: "C:\\Program Files\\OEC", global: true }, "win32")
  const command = invocation.args[3].replace(/^npm /, 'node -p process.argv -- ')
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { encoding: "utf8", windowsVerbatimArguments: true })
  expect({ command, status: result.status, stderr: result.stderr, stdout: result.stdout }).toMatchObject({ status: 0, stderr: "" })
  expect(result.stdout).toContain("'--prefix=C:\\\\Program Files\\\\OEC'")
})
