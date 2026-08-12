import { expect, test } from "bun:test"
import { launch } from "../bin/launcher.js"

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
    async wait() {
      calls.push({ command: "wait", args: [], env: undefined })
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
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "npm", "/bin/oec-2"])
  expect(deps.calls[0].env.OEC_NPM_LAUNCHER).toBe("1")
  expect(deps.calls[2].args).toEqual(["project"])
})

test("launcher retries one failed update before relaunching", async () => {
  const deps = dependencies([42, 1, 0, 0])
  expect(await launch([], deps)).toBe(0)
  expect(deps.calls.map((call) => call.command)).toEqual(["/bin/oec-1", "npm", "wait", "npm", "/bin/oec-2"])
})

test("launcher stops after two failed updates", async () => {
  const deps = dependencies([42, 1, 9])
  expect(await launch([], deps)).toBe(9)
  expect(deps.resolutions).toBe(1)
})
