import { isAbsolute, resolve } from "node:path"

export type DraftPreferences = { enabled: boolean; exclude: string[] }
export type EditorPreferences = { toggleBinding: string; diffBinding: string; explorerWidth: number; drafts: DraftPreferences }
export type EditorOptions = EditorPreferences & { localRoot: string }
export function parseOptions(value: Readonly<Record<string, unknown>>, directory?: string): EditorOptions {
  const root = value.localRoot === undefined ? directory : value.localRoot
  if (typeof root !== "string" || !isAbsolute(root)) {
    throw new Error("OEC: no absolute project directory is available. localRoot, when provided, must be an absolute local directory. Remote filesystem access is not supported.")
  }
  return { localRoot: resolve(root), ...parsePreferences(value) }
}

export function parsePreferences(value: Readonly<Record<string, unknown>>): EditorPreferences {
  for (const key of ["toggleBinding", "diffBinding", "filesBinding"] as const) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) throw new Error(`OEC: invalid ${key}`)
  }
  const width = value.explorerWidth ?? 30
  if (typeof width !== "number" || !Number.isInteger(width) || width < 18 || width > 60) throw new Error("OEC: explorerWidth must be between 18 and 60")
  const drafts = value.drafts ?? {}
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) throw new Error("OEC: invalid drafts options")
  const { enabled = true, exclude = [] } = drafts as Record<string, unknown>
  if (typeof enabled !== "boolean" || !Array.isArray(exclude) || !exclude.every((pattern) => typeof pattern === "string" && pattern.trim().length > 0 && !pattern.trimStart().startsWith("!") && !/[\r\n\0]/.test(pattern))) throw new Error("OEC: invalid drafts options (exclude must contain non-negated gitignore patterns)")
  // filesBinding remains an alias so existing F7 configurations keep working.
  return { toggleBinding: value.toggleBinding as string ?? "f6", diffBinding: value.diffBinding as string ?? value.filesBinding as string ?? "f7", explorerWidth: width, drafts: { enabled, exclude } }
}
