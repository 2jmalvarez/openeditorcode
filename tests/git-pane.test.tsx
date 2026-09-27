/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { GitPane } from "../src/git/GitPane"
import type { GitTreeItem } from "../src/git/tree"
import type { GitMode } from "../src/git/useGit"
import { t } from "../src/localization"

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
    expect(frame).toContain("2026-01-01")
    expect(frame).toContain(t("git.loadMore"))
    expect(frame).toContain(t("git.backHelp"))
    expect(frame).not.toContain("COMMIT_INPUT_VISIBLE")
    expect(frame).not.toContain("HIDDEN_TAIL")
    const lines = frame.split("\n")
    const commitLine = lines.findIndex((line) => line.includes("abc12345 initial"))
    expect(lines[commitLine + 1]).toContain("origin/feature/")
    expect(lines[commitLine + 2]).toContain("nested/file-")
    expect(lines[commitLine + 3]).toContain(t("git.loadMore"))
  } finally { setup.renderer.destroy() }
})

test("GitPane toggles localized commit IDs and dates independently in history", async () => {
  const [hashes, setHashes] = createSignal(true)
  const [dates, setDates] = createSignal(true)
  const row: GitTreeItem = { path: "abcdef123456", name: "A localized commit (Test)", depth: 0, directory: false, expanded: false, commit: { revision: "abcdef123456", author: "Test", date: "2026-09-27", subject: "A localized commit" } }
  const setup = await testRender(() => <GitPane active={() => true} state={() => ({ available: true, branch: "main", remoteStatus: "", files: [], message: "" })}
    tree={() => [row]} selected={() => 0} commitMessage={() => ""} setCommitMessage={() => {}} commitFocused={() => false}
    setScroll={() => {}} onActivate={() => {}} width={() => 60} mode={() => "history"} historyTitle={() => "Historial: main"} loading={() => false}
    showCommitHashes={hashes} showCommitDates={dates}
  />, { width: 60, height: 14 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("abcdef12")
    expect(setup.captureCharFrame()).toContain("2026-09-27")
    expect(setup.captureCharFrame()).toContain("H: ocultar IDs")
    expect(setup.captureCharFrame()).toContain("D: ocultar fechas")
    setHashes(false)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("abcdef12")
    expect(setup.captureCharFrame()).toContain("H: mostrar IDs")
    setDates(false)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("2026-09-27")
    expect(setup.captureCharFrame()).toContain("D: mostrar fechas")
  } finally { setup.renderer.destroy() }
})

test("GitPane preserves file number and changed lines beside a scrolling historical name", async () => {
  const [selected, setSelected] = createSignal(0)
  const rows: GitTreeItem[] = [
    { path: "first", name: "long-historical-filename-with-ending.ts", depth: 0, directory: false, expanded: false, fileNumber: 12, file: { path: "first", status: "modified", area: "changes", additions: 123, deletions: 45 } },
    { path: "binary", name: "binary-file.bin", depth: 0, directory: false, expanded: false, fileNumber: 13, file: { path: "binary", status: "modified", area: "changes", additions: null, deletions: null } },
  ]
  const setup = await testRender(() => <GitPane active={() => true} state={() => ({ available: true, branch: "main", remoteStatus: "", files: [], message: "" })}
    tree={() => rows} selected={selected} commitMessage={() => ""} setCommitMessage={() => {}} commitFocused={() => false}
    setScroll={() => {}} onActivate={() => {}} width={() => 32} mode={() => "files"} historyTitle={() => "Commit"} loading={() => false}
  />, { width: 32, height: 14 })
  try {
    await setup.renderOnce()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("12. M")
    expect(setup.captureCharFrame()).toContain(t("overlay.files", { count: 2 }))
    expect(setup.captureCharFrame()).toContain("+123 -45")
    expect(setup.captureCharFrame()).toContain("+? -?")
    const countedLine = setup.captureCharFrame().split("\n").find((line) => line.includes("+123 -45"))!
    expect(countedLine[countedLine.indexOf("+123") - 1]).toBe(" ")
    await Bun.sleep(1650)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("+123 -45")
    setSelected(1)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("long-historica")
  } finally { setup.renderer.destroy() }
})
