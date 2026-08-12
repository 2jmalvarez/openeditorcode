import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rename, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { alignDiff } from "../src/git/diff"
import { parseGitStatus, readGitDiff, readGitState } from "../src/git/status"
import type { OpenTab } from "../src/documents/types"
import { createGitTree } from "../src/git/tree"
import { fetchAndRefreshGit } from "../src/git/useGit"

const temporaryRoots: string[] = []

afterEach(async () => {
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
  expect(parseGitStatus(" M notes.txt\0A  added.ts\0D  deleted.ts\0R  renamed.ts\0old-name.ts\0?? new.txt\0")).toEqual([
    { path: "added.ts", status: "added" },
    { path: "deleted.ts", status: "deleted" },
    { path: "new.txt", status: "untracked" },
    { path: "notes.txt", status: "modified" },
    { path: "renamed.ts", status: "renamed", previousPath: "old-name.ts" },
  ])
})

test("reads an added file with empty previous content from a real repository", async () => {
  const root = await createRepository({ "tracked.txt": "tracked\n" })
  await writeFile(join(root, "added.txt"), "added content\n", "utf8")
  await git(root, "add", "added.txt")

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "added.txt")
  expect(file).toEqual({ path: "added.txt", status: "added" })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "", current: "added content\n" })
})

test("reads a deleted file with empty current content from a real repository", async () => {
  const root = await createRepository({ "deleted.txt": "deleted content\n" })
  await unlink(join(root, "deleted.txt"))

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "deleted.txt")
  expect(file).toEqual({ path: "deleted.txt", status: "deleted" })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "deleted content\n", current: "" })
})

test("reads renamed previous content from its original path in a real repository", async () => {
  const root = await createRepository({ "before.txt": "original content\n" })
  await rename(join(root, "before.txt"), join(root, "after.txt"))
  await git(root, "add", "-A")

  const file = (await readGitState(root)).files.find((candidate) => candidate.path === "after.txt")
  expect(file).toEqual({ path: "after.txt", status: "renamed", previousPath: "before.txt" })
  expect(await readGitDiff(root, file!)).toMatchObject({ previous: "original content\n", current: "original content\n" })
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
    { kind: "file", path: "README.md", content: "working copy", savedContent: "working copy" },
    { kind: "diff", path: "README.md", diff: { file: { path: "README.md", status: "modified" }, previous: "before", current: "after" } },
  ]
  expect(tabs.map((tab) => tab.kind)).toEqual(["file", "diff"])
})

test("groups changed files into expandable folders", () => {
  const files = [{ path: "src/editor/app.ts", status: "modified" as const }, { path: "src/workbench/layout.tsx", status: "added" as const }]
  expect(createGitTree(files, new Set(["src"])).map((item) => [item.name, item.depth])).toEqual([["src", 0], ["editor", 1], ["workbench", 1]])
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
