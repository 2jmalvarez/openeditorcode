import { expect, test } from "bun:test"
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
