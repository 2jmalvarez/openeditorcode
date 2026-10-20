import type { Context } from "@opencode/plugin/tui/context"
import { createHash } from "node:crypto"
import { homedir, hostname } from "node:os"
import { isAbsolute, resolve } from "node:path"

const identity = () => `${process.platform}\0${hostname()}\0${homedir()}`
const directoryKey = (directory: string) => process.platform === "win32" ? resolve(directory).toLowerCase() : resolve(directory)
const validFolders = (value: unknown): string[] => Array.isArray(value) ? value.filter((folder): folder is string => typeof folder === "string" && isAbsolute(folder)) : []

/** Local consent must not follow a synced plugin store onto another computer/user. */
export function createLocalAccess(storage: Context["storage"], machine = identity()) {
  const key = `local-access.v1.${createHash("sha256").update(machine).digest("hex")}`
  const [state, update] = storage.store(key, { initial: { folders: [] as string[] } })
  const folders = () => validFolders(state.folders)
  return {
    folders,
    trusted: (directory: string) => folders().some((folder) => directoryKey(folder) === directoryKey(directory)),
    remember: (directory: string) => update((draft) => {
      draft.folders = [...validFolders(draft.folders).filter((folder) => directoryKey(folder) !== directoryKey(directory)), resolve(directory)]
    }),
    forget: (directory: string) => update((draft) => {
      draft.folders = validFolders(draft.folders).filter((folder) => directoryKey(folder) !== directoryKey(directory))
    }),
  }
}
