import { extname } from "node:path"

const markdownExtensions = new Set([".md", ".markdown", ".mdown", ".mkd"])
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])

export const MAX_IMAGE_BYTES = 16 * 1024 * 1024
export function isMarkdownPath(path: string): boolean { return markdownExtensions.has(extname(path).toLowerCase()) }
export function isImagePath(path: string): boolean { return imageExtensions.has(extname(path).toLowerCase()) }
