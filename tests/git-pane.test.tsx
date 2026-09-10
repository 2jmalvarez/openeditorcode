/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { GitPane } from "../src/git/GitPane"
import type { GitTreeItem } from "../src/git/tree"
import type { GitMode } from "../src/git/useGit"

test("GitPane renders history rows without file metadata and hides the commit input outside local mode", async () => {
  const [mode, setMode] = createSignal<GitMode>("local")
  const rows: GitTreeItem[] = [
    { path: "commit", name: `abc12345 initial ${"long subject ".repeat(30)}HIDDEN_TAIL`, depth: 0, directory: false, expanded: false, commit: { revision: "abc12345", author: "Test", date: "2026-01-01", subject: "initial" } },
    { path: "branch", name: `origin/feature/${"long-branch-".repeat(30)}HIDDEN_TAIL`, depth: 0, directory: false, expanded: false, branch: { ref: "refs/remotes/origin/feature", name: "origin/feature", revision: "abc12345", current: false, remote: true } },
    { path: "file", name: `nested/file-${"long-name-".repeat(30)}HIDDEN_TAIL`, depth: 0, directory: false, expanded: false, file: { path: "nested/file.txt", status: "modified", area: "changes", additions: null, deletions: null }, fileNumber: 1 },
    { path: "more", name: "Cargar mas commits...", depth: 0, directory: false, expanded: false, loadMore: true },
  ]
  const setup = await testRender(() => <box style={{ height: 20, width: 60, flexDirection: "row" }}><GitPane
    active={() => true} state={() => ({ available: true, branch: "main", remoteStatus: "", files: [], message: "" })}
    tree={() => mode() === "local" ? [] : rows} selected={() => 0}
    commitMessage={() => "COMMIT_INPUT_VISIBLE"} setCommitMessage={() => {}} commitFocused={() => false}
    setScroll={() => {}} onActivate={() => {}} width={() => 60}
    mode={mode} historyTitle={() => "Historial: main"} loading={() => false}
  /></box>, { width: 60, height: 20 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("COMMIT_INPUT_VISIBLE")
    setMode("history")
    await setup.renderOnce()
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("Historial: main")
    expect(frame).toContain("abc12345 initial")
    expect(frame).toContain("Cargar mas commits")
    expect(frame).toContain("Esc: volver")
    expect(frame).not.toContain("COMMIT_INPUT_VISIBLE")
    expect(frame).not.toContain("HIDDEN_TAIL")
    const lines = frame.split("\n")
    const commitLine = lines.findIndex((line) => line.includes("abc12345 initial"))
    expect(lines[commitLine + 1]).toContain("origin/feature/")
    expect(lines[commitLine + 2]).toContain("nested/file-")
    expect(lines[commitLine + 3]).toContain("Cargar mas commits")
  } finally { setup.renderer.destroy() }
})
