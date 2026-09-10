import { expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseCli } from "../src/bootstrap/cli"
import { APP_VERSION } from "../src/bootstrap/version"

test("parses help, version, a project and dash-prefixed project paths", () => {
  expect(parseCli(["--help"])).toMatchObject({ exitCode: 0 })
  expect(parseCli(["project"])).toEqual({ project: "project" })
  expect(parseCli(["--", "-project"])).toEqual({ project: "-project" })
})

for (const alias of ["-v", "-V", "--version"]) {
  test(`prints the exact version for ${alias}`, () => {
    expect(parseCli([alias])).toEqual({ output: APP_VERSION, exitCode: 0 })
  })
}

test("treats all arguments after -- as operands, not options", () => {
  for (const operand of ["-v", "-V", "--version", "-h", "--help", "--"]) {
    expect(parseCli(["--", operand])).toEqual({ project: operand })
    expect(parseCli(["project", "--", operand])).toMatchObject({ exitCode: 2 })
  }
  expect(parseCli(["--"])).toEqual({ project: undefined })
  expect(parseCli(["project", "--"])).toEqual({ project: "project" })
  expect(parseCli(["-v", "--", "--help"])).toEqual({ output: APP_VERSION, exitCode: 0 })
  expect(parseCli(["--unknown", "--", "-v"])).toMatchObject({ exitCode: 2 })
})

test("rejects unknown options and multiple projects", () => {
  expect(parseCli(["--unknown"])).toMatchObject({ exitCode: 2 })
  expect(parseCli(["one", "two"])).toMatchObject({ exitCode: 2 })
})

for (const entry of ["src/index.tsx", "src/bootstrap/executable.ts"]) {
  test(`${entry} resolves CLI output without config or terminal startup`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "oec-cli-"))
    try {
      for (const option of ["-v", "-V", "--version", "--help", "--unknown"]) {
        // No OpenTUI preload or terminal: output-only invocations must not need the UI.
        const child = Bun.spawn([process.execPath, entry, option], {
          cwd: join(import.meta.dir, ".."),
          env: { ...process.env, OEC_CONFIG_DIR: directory, OEC_INTERNAL_WORKER: "0", OEC_TUI_SMOKE: "1", OEC_TUI_SMOKE_MARKER: join(directory, "ui-started") },
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          timeout: 10000,
        })
        const [output, errors, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ])
        expect(errors).toBe("")
        expect(code).toBe(option === "--unknown" ? 2 : 0)
        if (option === "--help") expect(output).toContain("-v, -V, --version")
        else if (option === "--unknown") expect(output).toMatch(/^(Usage|Uso): oec .+\n$/)
        else expect(output).toBe(`${APP_VERSION}\n`)
        expect(await readdir(directory)).toEqual([])
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 30000)
}
