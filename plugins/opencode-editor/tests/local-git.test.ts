import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { changePath, gitCommand, readLocalChanges, readLocalPatch } from "../src/changes/git"

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "oec-plugin-git-"))
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code) throw new Error(error)
    return out
  }
  await git("init", "-q")
  return { root, git, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test("Git local separates index/working tree, renames, deletions, binary and untracked without mutating status", async () => {
  const { root, git, cleanup } = await fixture()
  try {
    await writeFile(join(root, "both.ts"), "original\n")
    await writeFile(join(root, "old name.ts"), "rename\n")
    await writeFile(join(root, "removed.md"), "# Removed\n")
    await writeFile(join(root, "binary.png"), Buffer.from([0, 1, 2]))
    await git("add", ".")
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial")
    await git("mv", "old name.ts", "new name.ts")
    await writeFile(join(root, "both.ts"), "indexed\n")
    await git("add", "both.ts")
    await writeFile(join(root, "both.ts"), "working\n")
    await rm(join(root, "removed.md"))
    await writeFile(join(root, "binary.png"), Buffer.from([0, 2, 3]))
    await writeFile(join(root, "literal [x] '& café.txt"), "untracked\n")
    const before = await git("status", "--porcelain=v1")
    const result = await readLocalChanges(root, AbortSignal.timeout(10_000))
    expect(result.repository).toBe(true)
    const both = result.files.filter((file) => file.path === "both.ts")
    expect(both.map((file) => file.area)).toEqual(["staged", "changes"])
    const staged = await readLocalPatch(root, both[0]!)
    expect(staged).toContain("-original")
    expect(staged).toContain("+indexed")
    const working = await readLocalPatch(root, both[1]!)
    expect(working).toContain("-indexed")
    expect(working).toContain("+working")
    const renamed = result.files.find((file) => file.status === "renamed")!
    expect(renamed.previousPath).toBe("old name.ts")
    expect(await readLocalPatch(root, renamed)).toContain("rename to new name.ts")
    expect(await readLocalPatch(root, result.files.find((file) => file.status === "deleted")!)).toContain("-# Removed")
    expect(await readLocalPatch(root, result.files.find((file) => file.file === "binary.png")!)).toContain("Binary files")
    expect(await readLocalPatch(root, result.files.find((file) => file.status === "untracked")!)).toContain("+untracked")
    expect(await git("status", "--porcelain=v1")).toBe(before)
  } finally { await cleanup() }
})

test("unborn repositories and subdirectory roots stay within the consented project", async () => {
  const { root, git, cleanup } = await fixture()
  try {
    await mkdir(join(root, "nested"))
    await writeFile(join(root, "outside.txt"), "outside")
    await writeFile(join(root, "nested", "inside.txt"), "inside")
    await git("add", ".")
    const state = await readLocalChanges(join(root, "nested"), AbortSignal.timeout(10_000))
    expect(state.files.map((file) => file.file)).toEqual(["inside.txt"])
    expect(await readLocalPatch(join(root, "nested"), state.files[0]!)).toContain("+inside")
    for (const path of ["../escape", ".git/config", "C:/escape", "/escape", "x/../escape", "x\\escape"]) expect(() => changePath(root, path)).toThrow()
  } finally { await cleanup() }
})

test("uses literal WSL distribution arguments rather than Windows Git or a shell", () => {
  const args = gitCommand("\\\\wsl.localhost\\Ubuntu-24.04\\home\\juan\\a '& repo", ["status", "-z"], "win32")
  expect(args.slice(1, 5)).toEqual(["--distribution", "Ubuntu-24.04", "--exec", "git"])
  expect(args).toContain("/home/juan/a '& repo")
  expect(args).not.toContain("/bin/sh")
})

const distro = process.env.OEC_TEST_WSL_DISTRO
test.skipIf(process.platform !== "win32" || !distro)("reads real ext4 Git through Windows WSL mapping", async () => {
  const native = async (...args: string[]) => {
    const child = Bun.spawn(["wsl.exe", "-d", distro!, "--exec", ...args], { stdout: "pipe", stderr: "pipe" })
    const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (code) throw new Error(error)
    return out.trim()
  }
  const linux = await native("mktemp", "-d", "/tmp/oec-plugin-git-XXXXXXXX")
  const root = `\\\\wsl.localhost\\${distro}${linux.replace(/\//g, "\\")}`
  try {
    await native("git", "-C", linux, "init", "-q")
    await writeFile(join(root, "file.md"), "# WSL\n")
    await native("git", "-C", linux, "add", ".")
    const state = await readLocalChanges(root, AbortSignal.timeout(10_000))
    expect(state.repository).toBe(true)
    expect(state.files[0]?.area).toBe("staged")
    expect(await readLocalPatch(root, state.files[0]!)).toContain("+# WSL")
  } finally { await native("rm", "-rf", "--", linux) }
}, 30_000)
