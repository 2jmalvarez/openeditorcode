import { isAbsolute, resolve } from "node:path"

export type EditorOptions = { localRoot: string; toggleBinding: string; filesBinding: string; explorerWidth: number }
export function parseOptions(value: Readonly<Record<string, unknown>>): EditorOptions {
  if (typeof value.localRoot !== "string" || !isAbsolute(value.localRoot)) {
    throw new Error("OEC: configure options.localRoot with an absolute local project directory. Remote filesystem access is not supported.")
  }
  for (const key of ["toggleBinding", "filesBinding"] as const) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) throw new Error(`OEC: invalid ${key}`)
  }
  const width = value.explorerWidth ?? 30
  if (typeof width !== "number" || !Number.isInteger(width) || width < 18 || width > 60) throw new Error("OEC: explorerWidth must be between 18 and 60")
  return { localRoot: resolve(value.localRoot), toggleBinding: value.toggleBinding as string ?? "ctrl+alt+o", filesBinding: value.filesBinding as string ?? "ctrl+alt+j", explorerWidth: width }
}
