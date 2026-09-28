import { afterAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { discoverGitRepositories } from "../src/git/repositories"
import { readGitState } from "../src/git/status"

const roots: string[] = []

afterAll(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

async function git(root: string, ...args: string[]) {
  const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
  const [stderr, exitCode] = await Promise.all([new Response(process.stderr).text(), process.exited])
  if (exitCode !== 0) throw new Error(stderr)
}

async function repository(root: string, name: string, content: string) {
  const path = join(root, name)
  await mkdir(path)
  await git(path, "init", "--quiet")
  await git(path, "config", "user.name", "OEC Tests")
  await git(path, "config", "user.email", "oec@example.test")
  await writeFile(join(path, "same.txt"), content)
  await git(path, "add", ".")
  await git(path, "commit", "--quiet", "-m", "initial")
  return path
}

test("discovers independent child repositories and maps changed files to the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-git-repositories-"))
  roots.push(root)
  const first = await repository(root, "backend", "before")
  const second = await repository(root, "mobile", "before")
  await writeFile(join(first, "same.txt"), "backend change")
  await writeFile(join(second, "same.txt"), "mobile change")

  const repositories = await discoverGitRepositories(root)
  expect(repositories.map((item) => item.workspacePath)).toEqual(["backend", "mobile"])
  const [backend, mobile] = repositories
  expect((await readGitState(backend.root, backend.workspacePath)).files[0]?.workspacePath).toBe("backend/same.txt")
  expect((await readGitState(mobile.root, mobile.workspacePath)).files[0]?.workspacePath).toBe("mobile/same.txt")
})

test("does not descend into a discovered repository or ignored directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-git-repositories-"))
  roots.push(root)
  const parent = await repository(root, "parent", "before")
  await repository(parent, "nested", "before")
  await writeFile(join(root, ".gitignore"), "ignored/\n")
  await repository(root, "ignored", "before")

  expect((await discoverGitRepositories(root)).map((item) => item.workspacePath)).toEqual(["parent"])
})
