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
