import { afterAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { readTextFile } from "../src/documents/files"
import { readGitDiff, readGitState, restoreGitFiles, stageGitFiles, unstageGitFiles, type GitFile } from "../src/git/status"

const roots: string[] = []
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))) })

async function git(root: string, ...args: string[]) {
  const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exit] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (exit) throw new Error(stderr)
  return stdout.trim()
}

async function repository(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "oec-git-workspace-"))
  roots.push(root)
  await git(root, "init", "-q")
  await git(root, "config", "user.name", "Workspace Tests")
  await git(root, "config", "user.email", "workspace@example.test")
  await git(root, "config", "core.autocrlf", "false")
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  await git(root, "add", ".")
  await git(root, "commit", "-qm", "initial")
  return { root, workspace: join(root, "frontend") }
}

test("subfolder local and staged diffs expose workspace-relative paths usable by F4", async () => {
  const { root, workspace } = await repository({ "frontend/app.ts": "original\n", "outside.txt": "outside\n", "frontend-other/app.ts": "sibling\n" })
  await git(root, "config", "diff.relative", "true")
  await writeFile(join(workspace, "app.ts"), "staged\n")
  await writeFile(join(root, "outside.txt"), "outside staged\n")
  await git(root, "add", "frontend/app.ts", "outside.txt")
  await writeFile(join(workspace, "app.ts"), "working\n")
  await writeFile(join(root, "outside.txt"), "outside working\n")
  await writeFile(join(root, "frontend-other/app.ts"), "sibling working\n")
  await writeFile(join(workspace, "notes.txt"), "one\ntwo\n")
  await writeFile(join(root, "outside-new.txt"), "outside untracked\n")

  const files = (await readGitState(workspace)).files
  expect(files.map((file) => [file.area, file.path])).toEqual([["staged", "app.ts"], ["changes", "app.ts"], ["changes", "notes.txt"]])
  const staged = files.find((file) => file.area === "staged")!
  const changes = files.find((file) => file.area === "changes" && file.path === "app.ts")!
  const untracked = files.find((file) => file.path === "notes.txt")!
  expect(staged).toMatchObject({ additions: 1, deletions: 1 })
  expect(changes).toMatchObject({ additions: 1, deletions: 1 })
  expect(untracked).toMatchObject({ additions: 2, deletions: 0 })
  const stagedDiff = await readGitDiff(workspace, staged)
  const localDiff = await readGitDiff(workspace, changes)
  expect(stagedDiff).toMatchObject({ previous: "original\n", current: "staged\n" })
  expect(localDiff).toMatchObject({ previous: "staged\n", current: "working\n" })
  expect(await readGitDiff(workspace, untracked)).toMatchObject({ previous: "", current: "one\ntwo\n" })
  for (const diff of [stagedDiff, localDiff]) {
    expect(join(workspace, diff.file.path)).toBe(join(root, "frontend", "app.ts"))
    expect(await readTextFile(workspace, join(workspace, diff.file.path))).toBe("working\n")
  }
}, 15000)

test("subfolder mutations use literal workspace paths and leave outside changes untouched", async () => {
  const { root, workspace } = await repository({ "frontend/app[1].ts": "literal\n", "frontend/app1.ts": "other\n", "outside.txt": "outside\n" })
  await writeFile(join(workspace, "app[1].ts"), "literal changed\n")
  await writeFile(join(workspace, "app1.ts"), "other changed\n")
  await writeFile(join(root, "outside.txt"), "outside changed\n")
  await git(root, "add", "outside.txt")
  const file = (await readGitState(workspace)).files.find((file) => file.path === "app[1].ts")!
  expect(await stageGitFiles(workspace, [file])).toBe(true)
  expect(await git(root, "diff", "--cached", "--name-only")).toBe("frontend/app[1].ts\noutside.txt")
  const staged = (await readGitState(workspace)).files.find((file) => file.area === "staged")!
  expect(await readGitDiff(workspace, staged)).toMatchObject({ previous: "literal\n", current: "literal changed\n" })
  expect(await unstageGitFiles(workspace, [staged])).toBe(true)
  expect(await git(root, "diff", "--cached", "--name-only")).toBe("outside.txt")
  expect(await restoreGitFiles(workspace, [file])).toBe(true)
  expect(await readTextFile(workspace, join(workspace, "app[1].ts"))).toBe("literal\n")
  expect(await readTextFile(workspace, join(workspace, "app1.ts"))).toBe("other changed\n")
  for (const path of ["../outside.txt", "../../outside.txt", "/outside.txt", ".git/config"]) {
    const unsafe: GitFile = { ...file, path }
    expect(await stageGitFiles(workspace, [unsafe])).toBe(false)
    expect(await unstageGitFiles(workspace, [unsafe])).toBe(false)
    expect(await restoreGitFiles(workspace, [unsafe])).toBe(false)
    await expect(readGitDiff(workspace, unsafe)).rejects.toThrow()
  }
  expect(await git(root, "diff", "--cached", "--name-only")).toBe("outside.txt")
}, 15000)

test("renames inside a subfolder normalize both paths and unstage both index entries", async () => {
  const { root, workspace } = await repository({ "frontend/before.txt": "renamed content\n", "outside.txt": "outside\n" })
  await rename(join(workspace, "before.txt"), join(workspace, "after.txt"))
  await git(root, "add", "-A")
  const file = (await readGitState(workspace)).files[0]!
  expect(file).toMatchObject({ path: "after.txt", previousPath: "before.txt", status: "renamed", area: "staged", additions: 0, deletions: 0 })
  const diff = await readGitDiff(workspace, file)
  expect(diff).toMatchObject({ previous: "renamed content\n", current: "renamed content\n" })
  expect(await readTextFile(workspace, join(workspace, diff.file.path))).toBe("renamed content\n")
  expect(await unstageGitFiles(workspace, [file])).toBe(true)
  expect(await git(root, "diff", "--cached", "--name-only")).toBe("")
  const changes = (await readGitState(workspace)).files
  expect(changes.map((file) => [file.path, file.status])).toEqual([["after.txt", "untracked"], ["before.txt", "deleted"]])
  expect(await stageGitFiles(workspace, changes)).toBe(true)
  expect((await readGitState(workspace)).files[0]).toMatchObject({ path: "after.txt", previousPath: "before.txt", status: "renamed" })
}, 15000)

test("cross-boundary renames become workspace additions/deletions without mutating the external side", async () => {
  const { root, workspace } = await repository({ "incoming.txt": "inbound content\n", "frontend/outgoing.txt": "outbound content\n", "frontend/anchor.txt": "anchor\n" })
  await rename(join(root, "incoming.txt"), join(workspace, "arrived.txt"))
  await rename(join(workspace, "outgoing.txt"), join(root, "departed.txt"))
  await git(root, "add", "-A")
  const files = (await readGitState(workspace)).files
  expect(files).toHaveLength(2)
  const incoming = files.find((file) => file.path === "arrived.txt")!
  const outgoing = files.find((file) => file.path === "outgoing.txt")!
  expect(incoming).toMatchObject({ status: "added", area: "staged", additions: null, deletions: null })
  expect(outgoing).toMatchObject({ status: "deleted", area: "staged", additions: null, deletions: null })
  expect(incoming.previousPath).toBeUndefined()
  expect(outgoing.previousPath).toBeUndefined()
  const diff = await readGitDiff(workspace, incoming)
  expect(diff).toMatchObject({ previous: "", current: "inbound content\n" })
  expect(await readTextFile(workspace, join(workspace, diff.file.path))).toBe("inbound content\n")
  expect(await readGitDiff(workspace, outgoing)).toMatchObject({ previous: "outbound content\n", current: "" })
  expect(await unstageGitFiles(workspace, files)).toBe(true)
  expect(await git(root, "diff", "--cached", "--name-only", "--no-renames")).toBe("departed.txt\nincoming.txt")
  const localFiles = (await readGitState(workspace)).files
  const deleted = localFiles.find((file) => file.path === "outgoing.txt")!
  expect(await restoreGitFiles(workspace, [deleted])).toBe(true)
  expect(await readTextFile(workspace, join(workspace, "outgoing.txt"))).toBe("outbound content\n")
  expect(await readTextFile(root, join(root, "departed.txt"))).toBe("outbound content\n")
  expect(await git(root, "diff", "--cached", "--name-only", "--no-renames")).toBe("departed.txt\nincoming.txt")
}, 15000)
