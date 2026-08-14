import { afterAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { alignDiff } from "../src/git/diff"
import { parseGitNumstat, parseGitStatus, readGitDiff, readGitState, restoreGitFile, stageGitFile, unstageGitFile } from "../src/git/status"
import type { OpenTab } from "../src/documents/types"
import { createGitTree } from "../src/git/tree"
import { fetchAndRefreshGit } from "../src/git/useGit"

const temporaryRoots: string[] = []

afterAll(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function git(root: string, ...args: string[]): Promise<string> {
  const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`)
  return stdout
}

async function createRepository(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "oec-git-"))
  temporaryRoots.push(root)
  await git(root, "init", "--quiet")
  await git(root, "config", "user.name", "OEC Tests")
  await git(root, "config", "user.email", "oec@example.test")
  for (const [path, content] of Object.entries(files)) await writeFile(join(root, path), content, "utf8")
  await git(root, "add", ".")
  await git(root, "commit", "--quiet", "-m", "initial")
  return root
}

test("parses porcelain Git states including renamed paths", () => {
  expect(parseGitStatus(" M notes.txt\0A  added.ts\0D  deleted.ts\0R  renamed.ts\0old-name.ts\0MM both.ts\0?? new.txt\0")).toEqual([
    { path: "added.ts", status: "added", area: "staged", additions: null, deletions: null },
    { path: "both.ts", status: "modified", area: "staged", additions: null, deletions: null },
    { path: "deleted.ts", status: "deleted", area: "staged", additions: null, deletions: null },
    { path: "renamed.ts", status: "renamed", area: "staged", previousPath: "old-name.ts", additions: null, deletions: null },
    { path: "both.ts", status: "modified", area: "changes", additions: null, deletions: null },
    { path: "new.txt", status: "untracked", area: "changes", additions: null, deletions: null },
    { path: "notes.txt", status: "modified", area: "changes", additions: null, deletions: null },
  ])
})

test("parses normal, renamed, binary, and tabbed numstat records", () => {
  const output = ["2\t1\tnormal.txt", "-\t-\tbinary.dat", "3\t4\t", "before.txt", "after.txt", "1\t0\ttab\tname.txt", ""].join("\0")
  expect([...parseGitNumstat(output)]).toEqual([
    ["normal.txt", { additions: 2, deletions: 1 }],
    ["binary.dat", { additions: null, deletions: null }],
    ["after.txt", { additions: 3, deletions: 4 }],
    ["tab\tname.txt", { additions: 1, deletions: 0 }],
  ])
})

test("reads an added file with empty previous content from a real repository", async () => {
  const root = await createRepository({ "tracked.txt": "tracked\n" })
  await writeFile(join(root, "added.txt"), "added content\n", "utf8")
  await git(root, "add", "added.txt")

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "added.txt")
  expect(file).toEqual({ path: "added.txt", status: "added", area: "staged", additions: 1, deletions: 0 })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "", current: "added content\n" })
})

test("reads a deleted file with empty current content from a real repository", async () => {
  const root = await createRepository({ "deleted.txt": "deleted content\n" })
  await unlink(join(root, "deleted.txt"))

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "deleted.txt")
  expect(file).toEqual({ path: "deleted.txt", status: "deleted", area: "changes", additions: 0, deletions: 1 })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "deleted content\n", current: "" })
})

test("reads renamed previous content from its original path in a real repository", async () => {
  const root = await createRepository({ "before.txt": "original content\n" })
  await rename(join(root, "before.txt"), join(root, "after.txt"))
  await git(root, "add", "-A")

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "after.txt")
  expect(file).toEqual({ path: "after.txt", status: "renamed", area: "staged", previousPath: "before.txt", additions: 0, deletions: 0 })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "original content\n", current: "original content\n" })
})

test("reads staged and working diffs independently for the same file", async () => {
  const root = await createRepository({ "both.txt": "original\n" })
  await writeFile(join(root, "both.txt"), "staged\n", "utf8")
  await git(root, "add", "both.txt")
  await writeFile(join(root, "both.txt"), "working\n", "utf8")

  const files = (await readGitState(root)).files
  const staged = files.find((file) => file.path === "both.txt" && file.area === "staged")
  const changes = files.find((file) => file.path === "both.txt" && file.area === "changes")

  expect(await readGitDiff(root, staged!)).toMatchObject({ previous: "original\n", current: "staged\n" })
  expect(await readGitDiff(root, changes!)).toMatchObject({ previous: "staged\n", current: "working\n" })
})

test("stages and unstages a changed file", async () => {
  const root = await createRepository({ "tracked.txt": "original\n" })
  await writeFile(join(root, "tracked.txt"), "changed\n", "utf8")
  const changed = (await readGitState(root)).files.find((file) => file.path === "tracked.txt")!

  expect(await stageGitFile(root, changed)).toBe(true)
  const staged = (await readGitState(root)).files.find((file) => file.path === "tracked.txt")!
  expect(staged.area).toBe("staged")

  expect(await unstageGitFile(root, staged)).toBe(true)
  expect((await readGitState(root)).files).toContainEqual(expect.objectContaining({ path: "tracked.txt", area: "changes" }))
})

test("restores a changed or deleted tracked file", async () => {
  const root = await createRepository({ "tracked.txt": "original\n", "deleted.txt": "present\n" })
  await writeFile(join(root, "tracked.txt"), "changed\n", "utf8")
  const changed = (await readGitState(root)).files.find((file) => file.path === "tracked.txt")!
  expect(await restoreGitFile(root, changed)).toBe(true)
  expect(await readGitState(root)).toMatchObject({ files: [] })

  await unlink(join(root, "deleted.txt"))
  const deleted = (await readGitState(root)).files.find((file) => file.path === "deleted.txt")!
  expect(await restoreGitFile(root, deleted)).toBe(true)
  expect((await readFile(join(root, "deleted.txt"), "utf8")).replace(/\r\n/g, "\n")).toBe("present\n")
})

test("aligns removed and added lines into matching diff rows", () => {
  expect(alignDiff("one\ntwo\nthree\n", "one\nchanged\nthree\n")).toEqual([
    [
      { number: 1, text: "one", changed: false },
      { number: 2, text: "two", changed: true },
      { number: 3, text: "three", changed: false },
    ],
    [
      { number: 1, text: "one", changed: false },
      { number: 2, text: "changed", changed: true },
      { number: 3, text: "three", changed: false },
    ],
  ])
})

test("distinguishes file and diff tabs for the same path", () => {
  const tabs: OpenTab[] = [
    { kind: "file", source: "project", path: "README.md", content: "working copy", savedContent: "working copy", view: "source" },
    { kind: "diff", path: "README.md", diff: { file: { path: "README.md", status: "modified", area: "changes", additions: 1, deletions: 1 }, previous: "before", current: "after" } },
  ]
  expect(tabs.map((tab) => tab.kind)).toEqual(["file", "diff"])
})

test("groups changed files into expandable folders", () => {
  const files = [
    { path: "src/editor/app.ts", status: "modified" as const, area: "changes" as const, additions: 1, deletions: 1 },
    { path: "src/workbench/layout.tsx", status: "added" as const, area: "changes" as const, additions: 2, deletions: 0 },
  ]
  expect(createGitTree(files, new Set(["changes", "changes/src"])).map((item) => [item.name, item.depth])).toEqual([["CAMBIOS 2", 0], ["src", 1], ["editor", 2], ["workbench", 2]])
})

test("keeps file numbering based on Git state order across folders", () => {
  const files = [
    { path: "z.txt", status: "modified" as const, area: "changes" as const, additions: 1, deletions: 0 },
    { path: "folder/a.txt", status: "added" as const, area: "changes" as const, additions: 1, deletions: 0 },
  ]
  expect(createGitTree(files, new Set(["changes", "changes/folder"])).filter((item) => item.file).map((item) => [item.path, item.fileNumber])).toEqual([
    ["changes/folder/a.txt", 2],
    ["changes/z.txt", 1],
  ])
})

test("reads combined tracked and untracked statistics from a real repository", async () => {
  const root = await createRepository({
    "modified.txt": "one\ntwo\n",
    "deleted.txt": "gone\n",
    "before.txt": "same\n",
    "binary.dat": "text\n",
  })
  await writeFile(join(root, "modified.txt"), "one\nstaged\n", "utf8")
  await git(root, "add", "modified.txt")
  await writeFile(join(root, "modified.txt"), "one\nstaged\nworking\n", "utf8")
  await unlink(join(root, "deleted.txt"))
  await rename(join(root, "before.txt"), join(root, "after.txt"))
  await git(root, "add", "-A", "--", "deleted.txt", "before.txt", "after.txt")
  await writeFile(join(root, "untracked.txt"), "first\nsecond", "utf8")
  await writeFile(join(root, "untracked.bin"), new Uint8Array([0, 1, 2]))
  await writeFile(join(root, "binary.dat"), new Uint8Array([0, 1, 2]))

  const files = (await readGitState(root)).files
  expect(files.find((file) => file.path === "modified.txt" && file.area === "staged")).toMatchObject({ status: "modified", additions: 1, deletions: 1 })
  expect(files.find((file) => file.path === "modified.txt" && file.area === "changes")).toMatchObject({ status: "modified", additions: 1, deletions: 0 })
  expect(files.find((file) => file.path === "deleted.txt")).toMatchObject({ area: "staged", status: "deleted", additions: 0, deletions: 1 })
  expect(files.find((file) => file.path === "after.txt")).toMatchObject({ area: "staged", status: "renamed", additions: 0, deletions: 0, previousPath: "before.txt" })
  expect(files.find((file) => file.path === "untracked.txt")).toMatchObject({ area: "changes", status: "untracked", additions: 2, deletions: 0 })
  expect(files.find((file) => file.path === "untracked.bin")).toMatchObject({ area: "changes", status: "untracked", additions: null, deletions: null })
  expect(files.find((file) => file.path === "binary.dat")).toMatchObject({ area: "changes", status: "modified", additions: null, deletions: null })
})

test("lists files inside untracked directories instead of an empty tree row", async () => {
  const root = await createRepository({ "tracked.txt": "tracked\n" })
  await mkdir(join(root, "tools"))
  await writeFile(join(root, "tools", "script.ts"), "export {}\n", "utf8")

  const files = (await readGitState(root)).files
  expect(files).toEqual([
    { path: "tools/script.ts", status: "untracked", area: "changes", additions: 1, deletions: 0 },
  ])
  expect(createGitTree(files, new Set(["changes", "changes/tools"])).map((item) => item.name)).toEqual(["CAMBIOS 1", "tools", "script.ts"])
})

test("refreshes local Git state even when fetch fails", async () => {
  const statuses: string[] = []
  let refreshes = 0
  await fetchAndRefreshGit(
    "project",
    async () => { refreshes += 1 },
    (status) => statuses.push(status),
    async () => false,
  )

  expect(refreshes).toBe(1)
  expect(statuses).toEqual([
    "Actualizando referencias remotas y cambios de Git...",
    "Cambios de Git actualizados; no se pudieron actualizar las referencias remotas.",
  ])
})
