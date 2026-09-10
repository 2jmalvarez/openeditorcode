import { afterAll, expect, test } from "bun:test"
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRoot } from "solid-js"
import { readGitBranches, readGitCommitFiles, readGitHistoricalDiff, readGitHistory } from "../src/git/history"
import { useGit } from "../src/git/useGit"

const roots: string[] = []
afterAll(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))) })

async function git(root: string, ...args: string[]) {
  const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "pipe", stderr: "pipe" })
  const [output, error, exit] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (exit) throw new Error(error)
  return output.trim()
}

async function repository(initial = true) {
  const root = await mkdtemp(join(tmpdir(), "oec-history-"))
  roots.push(root)
  await git(root, "init", "-q", "-b", "main")
  await git(root, "config", "user.name", "History Test")
  await git(root, "config", "user.email", "history@example.test")
  await git(root, "config", "core.autocrlf", "false")
  if (initial) {
    await writeFile(join(root, "file.txt"), "initial\n")
    await git(root, "add", ".")
    await git(root, "commit", "-qm", "initial")
  }
  return root
}

test("history pages cover the complete immutable branch without a total cap", async () => {
  const root = await repository()
  const tree = await git(root, "rev-parse", "HEAD^{tree}")
  let tip = await git(root, "rev-parse", "HEAD")
  for (let index = 0; index < 104; index++) tip = await git(root, "commit-tree", tree, "-p", tip, "-m", `Commit ${index}`)
  await git(root, "update-ref", "refs/heads/main", tip)
  const first = await readGitHistory(root)
  expect(first.commits).toHaveLength(100)
  expect(first.hasMore).toBe(true)
  await git(root, "commit", "--allow-empty", "-qm", "new tip")
  const second = await readGitHistory(root, first.revision, 100)
  expect(second.commits).toHaveLength(5)
  expect(second.hasMore).toBe(false)
  expect(new Set([...first.commits, ...second.commits].map((commit) => commit.revision)).size).toBe(105)
  expect(second.commits.at(-1)?.subject).toBe("initial")
  expect(first.commits[0]).toMatchObject({ author: "History Test", subject: "Commit 103" })
  const state = createRoot((dispose) => ({ dispose, git: useGit({ root, autoRefresh: false, fetchOnRefresh: false, setStatus: () => {}, runActivity: async (_message, operation) => operation() }) }))
  try {
    await state.git.showHistory()
    expect(state.git.tree()).toHaveLength(101)
    state.git.select(100)
    expect(state.git.tree()[100]?.loadMore).toBe(true)
    await state.git.openSelected()
    expect(state.git.tree()).toHaveLength(106)
    expect(state.git.selected()).toBe(100)
    expect(state.git.tree()[100]?.commit).toBeDefined()
    expect(state.git.tree().some((row) => row.loadMore)).toBe(false)
    await git(root, "commit", "--allow-empty", "-qm", "latest tip")
    const rows = state.git.tree()
    await state.git.refresh()
    expect(state.git.tree()).toBe(rows)
    await state.git.fetch()
    expect(state.git.tree()).toHaveLength(101)
    expect(state.git.selected()).toBe(0)
    expect(state.git.tree()[0]?.commit?.subject).toBe("latest tip")
  } finally { state.dispose() }
}, 30000)

test("lists local and remote branches and reads them without checkout, including detached and unborn HEAD", async () => {
  const root = await repository()
  await git(root, "branch", "feature")
  await git(root, "update-ref", "refs/remotes/origin/feature", "HEAD")
  await git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/feature")
  const before = await git(root, "rev-parse", "HEAD")
  const branches = await readGitBranches(root)
  expect(branches.map((branch) => [branch.name, branch.current, branch.remote])).toEqual([
    ["feature", false, false], ["main", true, false], ["origin/feature", false, true],
  ])
  await readGitHistory(root, branches[0]!.ref)
  expect(await git(root, "symbolic-ref", "HEAD")).toBe("refs/heads/main")
  expect(await git(root, "rev-parse", "HEAD")).toBe(before)
  await git(root, "checkout", "--detach", "-q")
  expect((await readGitBranches(root)).some((branch) => branch.current)).toBe(false)
  expect((await readGitHistory(root)).revision).toBe(before)
  const empty = await repository(false)
  expect(await readGitHistory(empty)).toEqual({ commits: [], hasMore: false })
  expect(await readGitBranches(empty)).toEqual([])
})

test("root, rename and deletion diffs use committed blobs, not the working tree", async () => {
  const root = await repository()
  const initial = await git(root, "rev-parse", "HEAD")
  const initialFiles = await readGitCommitFiles(root, initial)
  expect(initialFiles[0]?.status).toBe("added")
  expect(await readGitHistoricalDiff(root, initial, initialFiles[0]!)).toMatchObject({ previous: "", current: "initial\n", revision: initial, previousRevision: null })
  await rename(join(root, "file.txt"), join(root, "renamed.txt"))
  await git(root, "add", "-A")
  await git(root, "commit", "-qm", "rename")
  const renamed = (await readGitCommitFiles(root, "HEAD"))[0]!
  expect(renamed).toMatchObject({ path: "renamed.txt", previousPath: "file.txt", status: "renamed" })
  await writeFile(join(root, "renamed.txt"), "dirty content\n")
  expect(await readGitHistoricalDiff(root, "HEAD", renamed)).toMatchObject({ previous: "initial\n", current: "initial\n", previousRevision: initial })
  await git(root, "rm", "-f", "renamed.txt")
  await git(root, "commit", "-qm", "delete")
  const deleted = (await readGitCommitFiles(root, "HEAD"))[0]!
  expect(deleted.status).toBe("deleted")
  expect(await readGitHistoricalDiff(root, "HEAD", deleted)).toMatchObject({ previous: "initial\n", current: "" })
})

test("merge file lists and diffs compare against the first parent", async () => {
  const root = await repository()
  await git(root, "checkout", "-qb", "feature")
  await writeFile(join(root, "feature.txt"), "feature\n")
  await git(root, "add", ".")
  await git(root, "commit", "-qm", "feature")
  await git(root, "checkout", "-q", "main")
  await writeFile(join(root, "main.txt"), "main\n")
  await git(root, "add", ".")
  await git(root, "commit", "-qm", "main")
  const firstParent = await git(root, "rev-parse", "HEAD")
  await git(root, "merge", "--no-ff", "-qm", "merge", "feature")
  const files = await readGitCommitFiles(root, "HEAD")
  expect(files.map((file) => file.path)).toEqual(["feature.txt"])
  expect(await readGitHistoricalDiff(root, "HEAD", files[0]!)).toMatchObject({ previousRevision: firstParent, previous: "", current: "feature\n" })
  expect((await readGitHistory(root)).commits).toHaveLength(4)
})

test("historical files enforce subtree paths, binary/UTF-8 and size limits", async () => {
  const root = await repository()
  await mkdir(join(root, "nested"))
  await writeFile(join(root, "nested", "file.txt"), "nested\n")
  await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2]))
  await writeFile(join(root, "invalid.txt"), Buffer.from([255, 254]))
  await writeFile(join(root, "large.txt"), "a".repeat(2 * 1024 * 1024 + 1))
  await git(root, "add", ".")
  await git(root, "commit", "-qm", "fixtures")
  const files = await readGitCommitFiles(root, "HEAD")
  for (const path of ["binary.bin", "invalid.txt", "large.txt"]) {
    await expect(readGitHistoricalDiff(root, "HEAD", files.find((file) => file.path === path)!)).rejects.toThrow()
  }
  const nested = join(root, "nested")
  const nestedFiles = await readGitCommitFiles(nested, "HEAD")
  expect(nestedFiles.map((file) => file.path)).toEqual(["file.txt"])
  expect(await readGitHistoricalDiff(nested, "HEAD", nestedFiles[0]!)).toMatchObject({ current: "nested\n" })
  for (const path of ["../file.txt", "/file.txt", "C:/file.txt", ".git/config", "nested/../../file.txt", "a\0b"]) {
    await expect(readGitHistoricalDiff(root, "HEAD", { ...files[0]!, path })).rejects.toThrow()
  }
  await expect(readGitHistory(root, "--all")).rejects.toThrow()
  await expect(readGitHistory(root, "HEAD", -1)).rejects.toThrow()
}, 15000)

test("useGit navigates levels, blocks mutations and restores local selection", async () => {
  const root = await repository()
  await writeFile(join(root, "file.txt"), "working\n")
  const errors: string[] = []
  const state = createRoot((dispose) => ({ dispose, git: useGit({ root, autoRefresh: false, setStatus: (message) => errors.push(message), runActivity: async (_message, operation) => operation() }) }))
  const model = state.git
  try {
    await model.refresh()
    for (let attempt = 0; attempt < 200 && !model.state().available; attempt++) await Bun.sleep(10)
    expect(model.state().available).toBe(true)
    await model.showHistory()
    expect(model.historyTitle()).toBe("Historial: main")
    expect(model.goBack()).toBe(true)
    model.select(model.tree().findIndex((row) => row.file))
    const localPath = model.tree()[model.selected()]!.path
    const localFiles = model.selectedFiles()
    await model.showBranches()
    expect(model.mode()).toBe("branches")
    await model.openSelected()
    expect(model.mode()).toBe("history")
    await model.openSelected()
    expect(model.mode()).toBe("files")
    expect(model.selectedFiles()).toEqual([])
    expect(model.selectedFile()).toBeUndefined()
    expect(await model.stageSelected()).toBe(false)
    expect(await model.unstageSelected()).toBe(false)
    expect(await model.restore(localFiles)).toBe(false)
    model.setCommitMessage("should not commit")
    expect(await model.commit()).toBe(false)
    expect(await model.pull()).toBe(false)
    expect(await model.push()).toBe(false)
    expect(await model.openSelected()).toMatchObject({ current: "initial\n", previousRevision: null })
    expect(model.mode()).toBe("files")
    expect(await model.openSelected()).toMatchObject({ current: "initial\n", previousRevision: null })
    for (const mode of ["history", "branches", "local"] as const) {
      expect(model.goBack()).toBe(true)
      expect(model.mode()).toBe(mode)
    }
    expect(model.tree()[model.selected()]!.path).toBe(localPath)
    expect(model.goBack()).toBe(false)
    expect(await git(root, "diff", "--name-only")).toBe("file.txt")
    expect(errors).toEqual([])
  } finally { state.dispose() }
}, 15000)

test("navigation cancellation prevents late history results and diffs after back/disposal", async () => {
  const root = await repository()
  const state = createRoot((dispose) => ({ dispose, git: useGit({ root, autoRefresh: false, setStatus: () => {}, runActivity: async (_message, operation) => operation() }) }))
  const model = state.git
  try {
    const pending = model.showHistory()
    expect(model.goBack()).toBe(true)
    await pending
    expect(model.mode()).toBe("local")
    const superseded = model.showHistory()
    await model.showBranches()
    await superseded
    expect(model.mode()).toBe("branches")
    await model.openSelected()
    await model.openSelected()
    const diff = model.openSelected()
    model.goBack()
    expect(await diff).toBeUndefined()
    expect(model.mode()).toBe("history")
    const disposed = model.showHistory()
    state.dispose()
    await disposed
    expect(model.tree()).toEqual([])
  } finally { state.dispose() }
})

for (const fetchOnRefresh of [true, false]) {
  test(`F5 refreshes branches and the selected branch history with fetchOnRefresh=${fetchOnRefresh}`, async () => {
    const source = await repository()
    const root = await repository()
    await git(root, "remote", "add", "origin", source)
    await git(root, "fetch", "-q", "origin")
    const failures: string[] = []
    const state = createRoot((dispose) => ({ dispose, git: useGit({ root, autoRefresh: false, fetchOnRefresh, setStatus: () => {}, reportFailure: (failure) => failures.push(failure.summary), runActivity: async (_message, operation) => operation() }) }))
    const model = state.git
    try {
      await model.showBranches()
      expect(model.tree().some((row) => row.branch?.name === "origin/feature")).toBe(false)
      await git(source, "branch", "feature")
      if (!fetchOnRefresh) {
        await git(root, "fetch", "-q", "origin")
        // A disabled fetch must not try to contact this now-invalid remote.
        await git(root, "remote", "set-url", "origin", join(root, "missing-remote"))
      }
      await model.fetch()
      expect(model.tree().some((row) => row.branch?.name === "origin/feature")).toBe(true)
      model.select(model.tree().findIndex((row) => row.branch?.name === "origin/main"))
      await model.openSelected()
      expect(model.historyTitle()).toBe("Historial: origin/main")
      expect(model.tree()[0]?.commit?.subject).toBe("initial")
      await git(source, "commit", "--allow-empty", "-qm", "remote update")
      const revision = await git(source, "rev-parse", "HEAD")
      if (!fetchOnRefresh) await git(root, "fetch", "-q", source, "refs/heads/main:refs/remotes/origin/main")
      const oldRows = model.tree()
      await model.refresh()
      expect(model.tree()).toBe(oldRows)
      await model.fetch()
      expect(model.mode()).toBe("history")
      expect(model.tree()[0]?.commit).toMatchObject({ revision, subject: "remote update" })
      expect(model.tree()).toHaveLength(2)
      expect(model.historyTitle()).toBe("Historial: origin/main")
      expect(model.goBack()).toBe(true)
      expect(model.mode()).toBe("branches")
      expect(model.tree()[model.selected()]?.branch?.name).toBe("origin/main")
      expect(model.goBack()).toBe(true)
      expect(model.mode()).toBe("local")
      expect(failures).toEqual([])
    } finally { state.dispose() }
  }, 15000)
}

test("a pending F5 does not replace a view entered after the refresh started", async () => {
  const root = await repository()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const state = createRoot((dispose) => ({ dispose, git: useGit({ root, autoRefresh: false, setStatus: () => {}, runActivity: async (_message, operation) => { await gate; return operation() } }) }))
  try {
    await state.git.showHistory()
    const pending = state.git.fetch()
    state.git.goBack()
    await state.git.showBranches()
    const rows = state.git.tree()
    release()
    await pending
    expect(state.git.mode()).toBe("branches")
    expect(state.git.tree()).toBe(rows)
  } finally { release(); state.dispose() }
})
