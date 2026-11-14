import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { parseCli, resolveCli } from "../src/bootstrap/cli"
import { resolveLaunchTarget } from "../src/bootstrap/resolve-root"
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

test("resolves directories and existing files, including spaces and relative paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-target-"))
  try {
    const directory = join(root, "a folder")
    await mkdir(directory)
    const file = join(directory, "a file.txt")
    await writeFile(file, "content")
    const physicalFile = await realpath(file)
    expect(resolveLaunchTarget()).toEqual({ root: process.cwd() })
    expect(resolveLaunchTarget(directory)).toEqual({ root: directory })
    expect(resolveLaunchTarget(file)).toEqual({ root: dirname(physicalFile), initialFile: physicalFile })
    expect(resolveLaunchTarget(relative(process.cwd(), file))).toEqual(resolveLaunchTarget(file))
    expect(resolveCli(["--", file])).toEqual(resolveLaunchTarget(file))
    expect(resolveCli([join(root, "missing.txt")])).toMatchObject({ exitCode: 1 })
    // Help and version do not inspect the operand.
    expect(resolveCli(["--help", join(root, "missing.txt")])).toMatchObject({ exitCode: 0 })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test.skipIf(process.platform === "win32")("opens a symlink file within its physical parent and rejects non-files", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-symlink-target-"))
  try {
    await mkdir(join(root, "links"))
    const file = join(root, "target.txt")
    await writeFile(file, "content")
    const link = join(root, "links", "-file.txt")
    await symlink(file, link)
    expect(resolveCli(["--", link])).toEqual(resolveLaunchTarget(file))
    expect(resolveCli(["/dev/null"])).toMatchObject({ exitCode: 1 })
  } finally { await rm(root, { recursive: true, force: true }) }
})

for (const entry of ["src/index.tsx", "src/bootstrap/executable.ts"]) {
  test(`${entry} rejects missing paths before config, recovery or UI startup`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "oec-cli-invalid-"))
    try {
      const child = Bun.spawn([process.execPath, entry, join(directory, "missing.txt")], {
        cwd: join(import.meta.dir, ".."),
        env: { ...process.env, OEC_CONFIG_DIR: directory, OEC_INTERNAL_WORKER: "0", OEC_TUI_SMOKE: "1", OEC_TUI_SMOKE_MARKER: join(directory, "ui-started") },
        stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10000,
      })
      const [output, errors, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code).toBe(1)
      expect(output).toContain("missing.txt")
      expect(errors).toBe("")
      expect(await readdir(directory)).toEqual([])
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
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
