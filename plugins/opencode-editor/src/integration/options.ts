import { isAbsolute, resolve } from "node:path"

export type DraftPreferences = { enabled: boolean; exclude: string[] }
export type SearchMode = "fuzzy" | "literal"
export type EditorPreferences = { toggleBinding: string; filesBinding: string; diffBinding: string; explorerWidth: number; drafts: DraftPreferences; searchMode: SearchMode; markdownPreview: boolean; diffView: "split" | "unified"; imageProtocol: "auto" | "blocks" }
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
  const searchMode = value.searchMode ?? "fuzzy"
  const markdownPreview = value.markdownPreview ?? true
  const diffView = value.diffView ?? "split"
  const imageProtocol = value.imageProtocol ?? "auto"
  if (searchMode !== "fuzzy" && searchMode !== "literal") throw new Error("OEC: invalid searchMode")
  if (typeof markdownPreview !== "boolean") throw new Error("OEC: invalid markdownPreview")
  if (diffView !== "split" && diffView !== "unified") throw new Error("OEC: invalid diffView")
  if (imageProtocol !== "auto" && imageProtocol !== "blocks") throw new Error("OEC: invalid imageProtocol")
  if (typeof width !== "number" || !Number.isInteger(width) || width < 18 || width > 60) throw new Error("OEC: explorerWidth must be between 18 and 60")
  const drafts = value.drafts ?? {}
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) throw new Error("OEC: invalid drafts options")
  const { enabled = true, exclude = [] } = drafts as Record<string, unknown>
  if (typeof enabled !== "boolean" || !Array.isArray(exclude) || !exclude.every((pattern) => typeof pattern === "string" && pattern.trim().length > 0 && !pattern.trimStart().startsWith("!") && !/[\r\n\0]/.test(pattern))) throw new Error("OEC: invalid drafts options (exclude must contain non-negated gitignore patterns)")
  return { toggleBinding: value.toggleBinding as string ?? "f6", filesBinding: value.filesBinding as string ?? "f7", diffBinding: value.diffBinding as string ?? "f8", explorerWidth: width, drafts: { enabled, exclude }, searchMode, markdownPreview, diffView, imageProtocol }
}
