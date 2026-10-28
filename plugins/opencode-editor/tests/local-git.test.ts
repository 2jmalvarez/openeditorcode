import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { changePath, changesError, createChangesReader, discoverLocalRepositories, gitCommand, readLocalChanges, readLocalPatch } from "../src/changes/git"
import { EditorController } from "../src/integration/controller"
import { parseOptions } from "../src/integration/options"
import { mockHost } from "./host"

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

test("container workspaces discover sibling and nested repositories, branches, clean repos and independent diff tabs", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-multi-repo-"))
  const run = async (directory: string, ...args: string[]) => {
    const child = Bun.spawn(["git", "-C", directory, ...args], { stdout: "pipe", stderr: "pipe" })
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code) throw new Error(error)
    return out.trim()
  }
  const controller = new EditorController(mockHost(root).context, parseOptions({ localRoot: root }))
  try {
    const a = join(root, "a"), b = join(root, "packages", "b"), clean = join(root, "clean"), nested = join(a, "nested")
    for (const directory of [a, b, clean, nested]) {
      await mkdir(directory, { recursive: true })
      await run(directory, "init", "-q", "-b", directory === b ? "feature/test" : "main")
    }
    await writeFile(join(a, "same.txt"), "from a\n")
    await writeFile(join(b, "same.txt"), "from b\n")
    await writeFile(join(nested, "inside.txt"), "nested\n")
    const result = await readLocalChanges(root, AbortSignal.timeout(10_000))
    expect(result.repository).toBe(true)
    expect(result.repositories?.map((repo) => repo.id)).toEqual(["a", "a/nested", "clean", "packages/b"])
    expect(result.repositories?.find((repo) => repo.id === "packages/b")?.branch).toBe("feature/test")
    expect(result.repositories?.every((repo) => !repo.error)).toBe(true)
    const same = result.files.filter((file) => file.path === "same.txt")
    expect(same).toHaveLength(2)
    expect(result.files.filter((file) => file.path === "inside.txt")).toHaveLength(1)
    expect(result.files.some((file) => file.repositoryRoot === a && file.path.startsWith("nested"))).toBe(false)
    for (const file of same) await controller.openDiff(file)
    const tabs = controller.workspace.documents.filter((file) => file.kind === "diff")
    expect(tabs).toHaveLength(2)
    expect(tabs.map((file) => file.content).join("\n")).toContain("+from a")
    expect(tabs.map((file) => file.content).join("\n")).toContain("+from b")
    await controller.alternateView()
    expect(controller.workspace.active?.path).toBe(join(b, "same.txt"))
    await expect(controller.openDiff({ ...same[0]!, repositoryRoot: tmpdir() })).rejects.toThrow()
    await run(b, "symbolic-ref", "HEAD", "refs/heads/changed")
    const refreshed = await readLocalChanges(root, AbortSignal.timeout(10_000))
    expect(refreshed.repositories?.find((repo) => repo.root === b)?.branch).toBe("changed")
    await rm(join(b, ".git"), { recursive: true })
    expect((await discoverLocalRepositories(root, AbortSignal.timeout(10_000))).includes(b)).toBe(false)
  } finally { await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("discovery skips ignored/dependency folders, supports gitfiles and detached HEAD, and aborts", async () => {
  const { root, git, cleanup } = await fixture()
  try {
    await writeFile(join(root, ".gitignore"), "ignored/\n")
    await git("add", ".gitignore")
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial")
    for (const name of ["ignored", "node_modules"]) {
      await mkdir(join(root, name))
      const child = Bun.spawn(["git", "-C", join(root, name), "init", "-q"], { stdout: "ignore", stderr: "pipe" })
      expect(await child.exited).toBe(0)
    }
    await git("worktree", "add", "-q", "--detach", "linked")
    const result = await readLocalChanges(root, AbortSignal.timeout(10_000))
    expect(result.repositories?.map((repo) => repo.id)).toEqual([".", "linked"])
    expect(result.repositories?.find((repo) => repo.id === "linked")?.branch).toContain("detached HEAD")
    const abort = new AbortController(); abort.abort()
    await expect(discoverLocalRepositories(root, abort.signal)).rejects.toThrow()
  } finally { await cleanup() }
})

test.skipIf(process.platform === "win32")("discovery never follows directory symlinks outside the workspace", async () => {
  const { root, cleanup } = await fixture()
  const container = await mkdtemp(join(tmpdir(), "oec-discovery-links-"))
  try {
    await symlink(root, join(container, "external"), "dir")
    const result = await readLocalChanges(container, AbortSignal.timeout(10_000))
    expect(result.repositories).toEqual([])
    expect(result.repository).toBe(false)
    await writeFile(join(root, "outside-ignore"), "external/\n")
    await symlink(join(root, "outside-ignore"), join(container, ".gitignore"))
    await expect(discoverLocalRepositories(container, AbortSignal.timeout(10_000))).rejects.toThrow()
  } finally { await cleanup(); await rm(container, { recursive: true, force: true }) }
})

test("workspace reader caches discovery, forces rescans and never shares caches across roots or readers", async () => {
  let scans = 0
  const options = {
    discover: async (root: string) => { scans++; return [root] },
    readRepository: async () => ({ repository: true, files: [] }),
  }
  const reader = createChangesReader(options)
  const signal = new AbortController().signal
  await reader("/a", signal)
  await reader("/a", signal)
  expect(scans).toBe(1)
  await reader("/a", signal, true)
  expect(scans).toBe(2)
  await reader("/b", signal)
  expect(scans).toBe(3)
  await createChangesReader(options)("/b", signal)
  expect(scans).toBe(4)
  const expired = createChangesReader({ ...options, discoveryTTL: 0 })
  await expired("/b", signal); await expired("/b", signal)
  expect(scans).toBe(6)
})

test("repository workers have independent deadlines, bounded concurrency and preserve healthy results", async () => {
  let active = 0, maximum = 0
  const reader = createChangesReader({
    timeoutMs: 20,
    discover: async () => ["/a", "/b", "/c", "/healthy"],
    readRepository: async (_root, directory, _roots, signal) => {
      active++; maximum = Math.max(maximum, active)
      try {
        if (directory !== "/healthy") {
          await Bun.sleep(40)
          signal.throwIfAborted()
        }
        signal.throwIfAborted()
        return { repository: true, repositories: [{ id: directory, root: directory, name: directory, branch: "main" }], files: [] }
      } catch (error) {
        return { repository: true, repositories: [{ id: directory, root: directory, name: directory, branch: "", error: changesError(error) }], files: [] }
      } finally { active-- }
    },
  })
  const result = await reader("/", new AbortController().signal)
  expect(maximum).toBe(3)
  expect(result.repositories?.map((repo) => repo.error)).toEqual(["Git refresh timed out", "Git refresh timed out", "Git refresh timed out", undefined])
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
