import { expect, test } from "bun:test"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createTextFile, ExternalFileChangedError, readTextFile } from "../src/documents/files"
import type { GitDiff } from "../src/documents/types"
import { useDocuments } from "../src/documents/useDocuments"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function diffDocuments(root: string, readFile?: typeof readTextFile) {
  let text = ""
  let status = ""
  const failures: unknown[] = []
  const documents = useDocuments({
    root, content: () => text, getText: () => text, setText: (value) => { text = value }, clearEditor: () => { text = "" },
    blurEditor: () => undefined, focusEditor: () => undefined, focusExplorer: () => undefined,
    setStatus: (value) => { status = value }, reportError: (failure) => { failures.push(failure) }, readFile,
  })
  return { documents, failures, text: () => text, edit: (value: string) => { text = value }, status: () => status }
}

const localDiff: GitDiff = {
  file: { path: "notes.txt", area: "changes", status: "modified", additions: 1, deletions: 1 },
  previous: "old revision", current: "diff content, not the working file",
}

test.each([
  { ...localDiff },
  { ...localDiff, file: { ...localDiff.file, area: "staged" as const } },
  { ...localDiff, revision: "a".repeat(40) },
  { ...localDiff, revision: "b".repeat(40), file: { ...localDiff.file, status: "deleted" as const } },
])("opens the working file from a diff and preserves unsaved buffers: %j", async (diff) => {
  const root = await mkdtemp(join(tmpdir(), "oec-diff-documents-"))
  try {
    const path = join(root, diff.file.path)
    await createTextFile(root, path)
    const { documents, text, edit } = diffDocuments(root)
    expect(await documents.openActiveDiffFile()).toBe(false)
    documents.openDiff(diff)
    expect(await documents.openActiveDiffFile()).toBe(true)
    expect(text()).toBe("")
    expect(documents.filePath()).toBe(path)
    expect(documents.tabs()).toHaveLength(2)
    edit("unsaved working buffer")
    documents.openDiff(diff)
    expect(documents.dirty()).toBe(false)
    expect(documents.isTabDirty(1)).toBe(true)
    expect(await documents.openActiveDiffFile()).toBe(true)
    expect(documents.tabs()).toHaveLength(2)
    expect(documents.activeTab()).toBe(1)
    expect(text()).toBe("unsaved working buffer")
    expect(documents.dirty()).toBe(true)
    expect(documents.tabs()[0]).toMatchObject({ kind: "diff", diff })
    expect(await readTextFile(root, path)).toBe("")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("keeps local, staged and historical diffs separate and only refreshes the same revision", () => {
  const { documents } = diffDocuments("root")
  const first = { ...localDiff, revision: "a".repeat(39) + "1" }
  const second = { ...localDiff, revision: "a".repeat(39) + "2" }
  const staged = { ...localDiff, file: { ...localDiff.file, area: "staged" as const } }
  for (const diff of [localDiff, staged, first, second]) documents.openDiff(diff)
  expect(documents.tabs()).toHaveLength(4)
  const refreshed = { ...first, current: "refreshed first revision" }
  documents.openDiff(refreshed)
  expect(documents.activeTab()).toBe(2)
  expect(documents.activeDiff()).toEqual(refreshed)
  expect(documents.tabs().map((tab) => tab.kind === "diff" ? tab.diff : undefined)).toEqual([localDiff, staged, refreshed, second])
})

test.each([false, true])("reports a missing working file without recreating it (already open: %s)", async (alreadyOpen) => {
  const root = await mkdtemp(join(tmpdir(), "oec-diff-missing-"))
  try {
    const path = join(root, localDiff.file.path)
    const { documents, failures, status, edit, text } = diffDocuments(root)
    if (alreadyOpen) {
      await createTextFile(root, path)
      await documents.openFile(path)
      edit("unsaved deleted file")
      await rm(path)
    }
    const diff = { ...localDiff, revision: "deleted-commit" }
    documents.openDiff(diff)
    const tabs = documents.tabs()
    expect(await documents.openActiveDiffFile()).toBe(false)
    expect(documents.tabs()).toEqual(tabs)
    expect(documents.activeDiff()).toEqual(diff)
    expect(failures).toHaveLength(1)
    expect(status()).not.toBe("")
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" })
    if (alreadyOpen) {
      documents.activateTab(0)
      expect(text()).toBe("unsaved deleted file")
      expect(documents.dirty()).toBe(true)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test.each(["close-before", "close-target", "close-diff", "activate", "next", "manual", "logs", "diff"])("cancels a pending diff file opening after %s", async (action) => {
  const read = deferred<string>()
  let pendingRead = false
  const root = "root"
  const path = join(root, localDiff.file.path)
  const before = join(root, "before.txt")
  const { documents, text, edit, status, failures } = diffDocuments(root, async () => pendingRead ? read.promise : "disk")
  await documents.openFile(before)
  await documents.openFile(path)
  edit("unsaved target")
  documents.openDiff(localDiff)
  documents.openLogs()
  documents.activateTab(2)
  pendingRead = true
  const opening = documents.openActiveDiffFile()

  if (action === "close-before") documents.closeTabsAffectedBy(before, false)
  else if (action === "close-target") documents.closeTabsAffectedBy(path, false)
  else if (action === "close-diff") documents.closeFile()
  else if (action === "activate") documents.activateTab(0)
  else if (action === "next") documents.changeTab(1)
  else if (action === "manual") documents.openManual("MANUAL.md", "manual")
  else if (action === "logs") documents.openLogs()
  else documents.openDiff({ ...localDiff, revision: "another-commit" })

  const selected = documents.tabs()[documents.activeTab()]
  const tabs = documents.tabs()
  const currentText = text()
  const currentStatus = status()
  read.resolve("new disk content")
  expect(await opening).toBe(false)
  expect(documents.tabs()).toEqual(tabs)
  expect(documents.tabs()[documents.activeTab()]).toBe(selected)
  expect(text()).toBe(currentText)
  expect(status()).toBe(currentStatus)
  expect(failures).toHaveLength(0)
  if (action !== "close-target") {
    const targetIndex = documents.tabs().findIndex((tab) => tab.kind === "file" && tab.path === path)
    documents.activateTab(targetIndex)
    expect(text()).toBe("unsaved target")
    expect(documents.dirty()).toBe(true)
  }
})

test.each(["close", "close-affected", "reject"])("ignores a pending verification after closing the last tab: %s", async (action) => {
  const read = deferred<string>()
  let pendingRead = false
  const { documents, status, failures } = diffDocuments("root", async () => pendingRead ? read.promise : "disk")
  await documents.openFile("only.txt")
  pendingRead = true
  const opening = documents.openFile("only.txt", true)
  if (action === "close-affected") documents.closeTabsAffectedBy("only.txt", false)
  else documents.closeFile()
  const closedStatus = status()
  if (action === "reject") read.reject(new Error("obsolete failure"))
  else read.resolve("disk")
  expect(await opening).toBe(false)
  expect(documents.tabs()).toEqual([])
  expect(documents.activeTab()).toBe(-1)
  expect(documents.filePath()).toBeUndefined()
  expect(status()).toBe(closedStatus)
  expect(failures).toHaveLength(0)
})

test("keeps the latest file open when reads complete out of order", async () => {
  const reads = new Map<string, ReturnType<typeof deferred<string>>>()
  let text = ""
  let status = ""
  const documents = useDocuments({
    root: "root",
    content: () => text,
    getText: () => text,
    setText: (value) => { text = value },
    clearEditor: () => { text = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: (value) => { status = value },
    readFile: async (_root, path) => {
      const read = deferred<string>()
      reads.set(path, read)
      return read.promise
    },
  })

  const first = documents.openFile("first.txt")
  const second = documents.openFile("second.txt")
  reads.get("second.txt")!.resolve("second")
  expect(await second).toBe(true)
  reads.get("first.txt")!.resolve("first")
  expect(await first).toBe(false)

  expect(documents.filePath()).toBe("second.txt")
  expect(documents.tabs().map((tab) => tab.path)).toEqual(["second.txt"])
  expect(text).toBe("second")
  expect(status).toContain("second.txt")
})

test("ignores an obsolete file read error", async () => {
  const reads = new Map<string, ReturnType<typeof deferred<string>>>()
  let text = ""
  let status = ""
  const documents = useDocuments({
    root: "root",
    content: () => text,
    getText: () => text,
    setText: (value) => { text = value },
    clearEditor: () => { text = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: (value) => { status = value },
    readFile: async (_root, path) => {
      const read = deferred<string>()
      reads.set(path, read)
      return read.promise
    },
  })

  const first = documents.openFile("first.txt")
  const second = documents.openFile("second.txt")
  reads.get("second.txt")!.resolve("second")
  await second
  reads.get("first.txt")!.reject(new Error("stale failure"))
  expect(await first).toBe(false)

  expect(status).toContain("second.txt")
  expect(status).not.toContain("stale failure")
})

test("keeps CRLF files clean when opening and switching tabs", async () => {
  let content = ""
  let textareaText = ""
  const documents = useDocuments({
    root: "root",
    content: () => content,
    getText: () => textareaText,
    setText: (value) => {
      content = value
      textareaText = value.replace(/\r\n?/g, "\n")
    },
    clearEditor: () => { content = ""; textareaText = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: () => undefined,
    readFile: async (_root, path) => path === "first.txt" ? "first line\r\nsecond line\r\n" : "second line\n",
  })

  await documents.openFile("first.txt")
  expect(documents.dirty()).toBe(false)
  expect(documents.hasDirtyTabs()).toBe(false)

  await documents.openFile("second.txt")
  expect(documents.isTabDirty(0)).toBe(false)
  expect(documents.isTabDirty(1)).toBe(false)
  expect(documents.hasDirtyTabs()).toBe(false)

  documents.activateTab(0)
  expect(documents.filePath()).toBe("first.txt")
  expect(documents.dirty()).toBe(false)
  expect(documents.hasDirtyTabs()).toBe(false)
})

test("preserves CRLF when saving edits made through the normalized textarea", async () => {
  let content = ""
  let textareaText = ""
  let write: { content: string; expectedContent?: string } | undefined
  const opened = "first line\r\nsecond line\r\n"
  const documents = useDocuments({
    root: "root",
    content: () => content,
    getText: () => textareaText,
    setText: (value) => {
      content = value
      textareaText = value.replace(/\r\n?/g, "\n")
    },
    clearEditor: () => { content = ""; textareaText = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: () => undefined,
    readFile: async () => opened,
    writeFile: async (_root, _path, value, options) => { write = { content: value, expectedContent: options?.expectedContent } },
  })

  await documents.openFile("first.txt")
  content = "first line\nchanged line\n"
  textareaText = content
  documents.syncContent(content)

  expect(await documents.save()).toBe(true)
  expect(write).toEqual({ content: "first line\r\nchanged line\r\n", expectedContent: opened })
  expect(documents.dirty()).toBe(false)
})

test("keeps Markdown preview content read-only until switching to source and keeps manuals immutable", async () => {
  let text = ""
  let status = ""
  const documents = useDocuments({
    root: "root",
    content: () => text,
    getText: () => text,
    setText: (value) => { text = value },
    clearEditor: () => { text = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: (value) => { status = value },
    readFile: async () => "# Documento\n\nInicial",
  })

  await documents.openFile("README.md")
  expect(documents.activePreview()).toBe(true)
  expect(documents.activePreviewContent()).toContain("Documento")
  expect(text).toBe("")
  expect(documents.dirty()).toBe(false)
  expect(documents.isTabDirty(0)).toBe(false)

  documents.togglePreview()
  expect(documents.activePreview()).toBe(false)
  expect(text).toContain("Inicial")
  text = "# Documento\n\nEditado"
  documents.syncContent(text)
  documents.togglePreview()
  expect(documents.activePreviewContent()).toContain("Editado")
  expect(documents.dirty()).toBe(true)

  documents.openManual("MANUAL.md", "# Manual")
  expect(documents.activeManual()?.content).toBe("# Manual")
  expect(documents.dirty()).toBe(false)
  documents.syncContent("modificado")
  expect(documents.activeManual()?.content).toBe("# Manual")
  documents.togglePreview()
  expect(status).toContain("solo lectura")
  expect(await documents.save()).toBe(false)
})

test("opens a single read-only log tab without retaining it in the editor", async () => {
  let text = ""
  let status = ""
  const documents = useDocuments({
    root: "root", content: () => text, getText: () => text, setText: (value) => { text = value }, clearEditor: () => { text = "" },
    blurEditor: () => undefined, focusEditor: () => undefined, focusExplorer: () => undefined, setStatus: (value) => { status = value },
  })

  documents.openLogs()
  documents.openLogs()

  expect(documents.tabs()).toEqual([{ kind: "logs", path: "REGISTRO" }])
  expect(documents.activeLogs()?.path).toBe("REGISTRO")
  expect(documents.filePath()).toBeUndefined()
  expect(documents.dirty()).toBe(false)
  expect(await documents.save()).toBe(false)
  expect(status).toContain("solo lectura")
})

test("opens and saves the trusted OEC configuration separately from project files", async () => {
  let text = ""
  let saved = ""
  const documents = useDocuments({
    root: "root",
    content: () => text,
    getText: () => text,
    setText: (value) => { text = value },
    clearEditor: () => { text = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: () => undefined,
    readConfig: async () => '{"schemaVersion":2}',
    writeConfig: async (_source, content) => { saved = content },
  })

  await documents.openConfig("config.json")
  expect(documents.tabs()[0]).toMatchObject({ kind: "file", source: "config-global", view: "source" })
  text = '{"schemaVersion":2,"edited":true}'
  expect(await documents.save()).toBe(true)
  expect(saved).toContain("edited")
})

test("keeps an edited buffer until the user resolves an external file change", async () => {
  let text = ""
  let status = ""
  let disk = "opened"
  const writes: Array<{ content: string; expectedContent?: string }> = []
  const documents = useDocuments({
    root: "root",
    content: () => text,
    getText: () => text,
    setText: (value) => { text = value },
    clearEditor: () => { text = "" },
    blurEditor: () => undefined,
    focusEditor: () => undefined,
    focusExplorer: () => undefined,
    setStatus: (value) => { status = value },
    readFile: async () => disk,
    writeFile: async (_root, _path, content, options) => {
      writes.push({ content, expectedContent: options?.expectedContent })
      if (options?.expectedContent !== undefined && disk !== options.expectedContent) {
        throw new ExternalFileChangedError("changed externally")
      }
      disk = content
    },
  })

  await documents.openFile("notes.txt")
  text = "local edit"
  documents.syncContent(text)
  disk = "external edit"

  expect(await documents.save()).toBe(false)
  expect(documents.externalChange()).toBe("notes.txt")
  expect(text).toBe("local edit")
  expect(status).toContain("changed externally")

  expect(await documents.reloadActiveFile()).toBe(true)
  expect(text).toBe("external edit")
  expect(documents.externalChange()).toBeUndefined()

  text = "overwrite external"
  documents.syncContent(text)
  disk = "another external edit"
  expect(await documents.save(true)).toBe(true)
  expect(disk).toBe("overwrite external")
  expect(writes.at(-1)).toEqual({ content: "overwrite external", expectedContent: undefined })
})
