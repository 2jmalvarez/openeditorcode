import { expect, test } from "bun:test"
import { ExternalFileChangedError } from "../src/documents/files"
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
    writeConfig: async (content) => { saved = content },
  })

  await documents.openConfig("config.json")
  expect(documents.tabs()[0]).toMatchObject({ kind: "file", source: "config", view: "source" })
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
