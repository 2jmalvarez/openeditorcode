import { isAbsolute, resolve } from "node:path"

export type EditorPreferences = { toggleBinding: string; filesBinding: string; explorerWidth: number }
export type EditorOptions = EditorPreferences & { localRoot: string }
export function parseOptions(value: Readonly<Record<string, unknown>>, directory?: string): EditorOptions {
  const root = value.localRoot === undefined ? directory : value.localRoot
  if (typeof root !== "string" || !isAbsolute(root)) {
    throw new Error("OEC: no absolute project directory is available. localRoot, when provided, must be an absolute local directory. Remote filesystem access is not supported.")
  }
  return { localRoot: resolve(root), ...parsePreferences(value) }
}

export function parsePreferences(value: Readonly<Record<string, unknown>>): EditorPreferences {
  for (const key of ["toggleBinding", "filesBinding"] as const) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) throw new Error(`OEC: invalid ${key}`)
  }
  const width = value.explorerWidth ?? 30
  if (typeof width !== "number" || !Number.isInteger(width) || width < 18 || width > 60) throw new Error("OEC: explorerWidth must be between 18 and 60")
  return { toggleBinding: value.toggleBinding as string ?? "ctrl+alt+o", filesBinding: value.filesBinding as string ?? "ctrl+alt+j", explorerWidth: width }
}
