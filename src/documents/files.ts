import { randomBytes } from "node:crypto"
import { chmod, lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { t } from "../localization"
import { writeAndReplaceWindowsFile } from "./windows-save"
import { parseWslPath, WslFileChangedError, writeWslFile } from "./wsl-save"
import { svgWasmPath, svgFontPath } from "./svg-assets"

// Build-time assets are embedded by Bun in the standalone executable. These are
// fixed package resources, never paths supplied by an SVG or by the user.
export async function readSvgAssets(): Promise<{ wasm: ArrayBuffer; font: Uint8Array }> {
  const [wasm, font] = await Promise.all([Bun.file(svgWasmPath).arrayBuffer(), Bun.file(svgFontPath).bytes()])
  return { wasm, font }
}

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024

export class FileAccessError extends Error {}
export class ExternalFileChangedError extends FileAccessError {}

type WriteTextFileOptions = {
  expectedContent?: string
}

function isInside(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target)
  return pathFromRoot === "" || (!isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`))
}

export function ensureInsideRoot(root: string, target: string): string {
  const absoluteRoot = resolve(root)
  const absoluteTarget = resolve(target)

  if (isInside(absoluteRoot, absoluteTarget)) {
    return absoluteTarget
  }

  throw new FileAccessError(t("files.outside"))
}

async function nearestExistingPath(target: string): Promise<string> {
  let candidate = target
  while (true) {
    try {
      await lstat(candidate)
      return candidate
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      const parent = dirname(candidate)
      if (parent === candidate) throw error
      candidate = parent
    }
  }
}

export async function ensurePhysicallyInsideRoot(root: string, target: string): Promise<string> {
  const safePath = ensureInsideRoot(root, target)
  const physicalRoot = await realpath(resolve(root))
  const existingPath = await nearestExistingPath(safePath)
  const physicalExistingPath = await realpath(existingPath)

  if (!isInside(physicalRoot, physicalExistingPath)) {
    throw new FileAccessError(t("files.outside"))
  }
  return safePath
}

async function ensureParentPhysicallyInsideRoot(root: string, target: string): Promise<void> {
  const physicalRoot = await realpath(resolve(root))
  const physicalParent = await realpath(dirname(target))
  if (!isInside(physicalRoot, physicalParent)) {
    throw new FileAccessError(t("files.outside"))
  }
}

export async function readTextFile(root: string, filePath: string): Promise<string> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  const info = await stat(safePath)
  if (!info.isFile()) throw new FileAccessError(t("files.notFile"))
  if (info.size > MAX_FILE_BYTES) throw new FileAccessError(t("files.tooLarge"))

  const content = await readFile(safePath)
  if (content.includes(0)) throw new FileAccessError(t("files.binary"))
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content)
  } catch {
    throw new FileAccessError(t("files.invalidUtf8"))
  }
}

export async function readImageFile(root: string, filePath: string): Promise<Uint8Array> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  const info = await stat(safePath)
  if (!info.isFile()) throw new FileAccessError(t("files.notFile"))
  if (info.size > MAX_IMAGE_BYTES) throw new FileAccessError(t("files.imageTooLarge"))
  const content = await readFile(safePath)
  if (content.length > MAX_IMAGE_BYTES) throw new FileAccessError(t("files.imageTooLarge"))
  return content
}

export async function writeTextFile(root: string, filePath: string, content: string, options: WriteTextFileOptions = {}): Promise<void> {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new FileAccessError(t("files.tooLarge"))
  }

  const safePath = await ensurePhysicallyInsideRoot(root, filePath)

  if (options.expectedContent !== undefined) {
    try {
      const currentContent = await readTextFile(root, safePath)
      if (currentContent !== options.expectedContent) {
        throw new ExternalFileChangedError(t("files.externalChange"))
      }
    } catch (error) {
      if (error instanceof ExternalFileChangedError) throw error
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ExternalFileChangedError(t("files.externalChange"))
      }
      throw error
    }
  }

  await mkdir(dirname(safePath), { recursive: true })
  await ensureParentPhysicallyInsideRoot(root, safePath)

  const wslTarget = process.platform === "win32" ? parseWslPath(safePath) : undefined
  if (wslTarget) {
    const wslRoot = parseWslPath(resolve(root))
    if (!wslRoot) throw new FileAccessError(t("files.outside"))
    try { await writeWslFile(wslRoot, wslTarget, content, options.expectedContent) }
    catch (error) {
      if (error instanceof WslFileChangedError) throw new ExternalFileChangedError(t("files.externalChange"))
      throw error
    }
    return
  }

  let mode = 0o600
  try { mode = (await stat(safePath)).mode & 0o777 } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  let temporaryPath = ""
  try {
    while (true) {
      temporaryPath = `${safePath}.oec-${randomBytes(12).toString("hex")}.tmp`
      try {
        await writeFile(temporaryPath, process.platform === "win32" ? "" : content, { encoding: "utf8", flag: "wx", mode: 0o600 })
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
    }
    if (process.platform === "win32") await writeAndReplaceWindowsFile(temporaryPath, safePath, content)
    else {
      await chmod(temporaryPath, mode)
      await rename(temporaryPath, safePath)
    }
  } finally {
    if (temporaryPath !== "") await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

export async function createTextFile(root: string, filePath: string): Promise<void> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  await mkdir(dirname(safePath), { recursive: true })
  await ensureParentPhysicallyInsideRoot(root, safePath)
  try {
    await writeFile(safePath, "", { encoding: "utf8", flag: "wx", mode: 0o600 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new FileAccessError(t("files.exists"))
    }
    throw error
  }
}

export async function removeProjectEntry(root: string, targetPath: string): Promise<void> {
  const safePath = ensureInsideRoot(root, targetPath)
  if (safePath === resolve(root)) throw new FileAccessError(t("files.deleteRoot"))

  await ensureParentPhysicallyInsideRoot(root, safePath)
  const info = await lstat(safePath)
  if (!info.isSymbolicLink()) await ensurePhysicallyInsideRoot(root, safePath)
  await rm(safePath, { recursive: true, force: false })
}

export async function renameProjectEntry(root: string, targetPath: string, name: string): Promise<string> {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new FileAccessError(t("files.invalidName"))
  }
  const safePath = ensureInsideRoot(root, targetPath)
  if (safePath === resolve(root)) throw new FileAccessError(t("files.renameRoot"))
  await ensureParentPhysicallyInsideRoot(root, safePath)
  const info = await lstat(safePath)
  if (!info.isSymbolicLink()) await ensurePhysicallyInsideRoot(root, safePath)

  const nextPath = ensureInsideRoot(root, resolve(dirname(safePath), name))
  if (nextPath === safePath) return safePath
  await ensureParentPhysicallyInsideRoot(root, nextPath)
  try {
    await lstat(nextPath)
    throw new FileAccessError(t("files.entryExists"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await rename(safePath, nextPath)
  return nextPath
}
