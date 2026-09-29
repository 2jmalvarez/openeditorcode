import { expect, test } from "bun:test"
import { launch, launcherLanguage } from "../bin/launcher.js"

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
  expect(await launch(["project"], deps)).toBe(0)
  expect(deps.resolutions).toBe(2)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "backup", "npm", "/bin/oec-2", "cleanup"])
  expect(deps.calls[0].env.OEC_NPM_LAUNCHER).toBe("1")
  expect(deps.calls[2].args).toEqual(["install", "-g", "openeditorcode@latest", "--registry=https://registry.npmjs.org/", "--@2jmalvarez:registry=https://registry.npmjs.org/"])
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
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls[2]).toMatchObject({ command: "cmd.exe", args: ["/d", "/s", "/c", "npm install -g openeditorcode@latest --registry=https://registry.npmjs.org/ --@2jmalvarez:registry=https://registry.npmjs.org/"] })
})
