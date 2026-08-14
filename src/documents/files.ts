import { randomBytes } from "node:crypto"
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024

export class FileAccessError extends Error {}

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

  throw new FileAccessError("La ruta solicitada está fuera de la carpeta abierta.")
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

async function ensurePhysicallyInsideRoot(root: string, target: string): Promise<string> {
  const safePath = ensureInsideRoot(root, target)
  const physicalRoot = await realpath(resolve(root))
  const existingPath = await nearestExistingPath(safePath)
  const physicalExistingPath = await realpath(existingPath)

  if (!isInside(physicalRoot, physicalExistingPath)) {
    throw new FileAccessError("La ruta solicitada está fuera de la carpeta abierta.")
  }
  return safePath
}

async function ensureParentPhysicallyInsideRoot(root: string, target: string): Promise<void> {
  const physicalRoot = await realpath(resolve(root))
  const physicalParent = await realpath(dirname(target))
  if (!isInside(physicalRoot, physicalParent)) {
    throw new FileAccessError("La ruta solicitada está fuera de la carpeta abierta.")
  }
}

export async function readTextFile(root: string, filePath: string): Promise<string> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  const info = await stat(safePath)
  if (!info.isFile()) throw new FileAccessError("La ruta seleccionada no es un archivo.")
  if (info.size > MAX_FILE_BYTES) throw new FileAccessError("El archivo supera el límite de 2 MB.")

  const content = await readFile(safePath)
  if (content.includes(0)) throw new FileAccessError("Los archivos binarios no se pueden editar.")
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content)
  } catch {
    throw new FileAccessError("El archivo no contiene texto UTF-8 válido.")
  }
}

export async function readImageFile(root: string, filePath: string): Promise<Uint8Array> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  const info = await stat(safePath)
  if (!info.isFile()) throw new FileAccessError("La ruta seleccionada no es un archivo.")
  if (info.size > MAX_IMAGE_BYTES) throw new FileAccessError("La imagen supera el límite de 16 MB.")
  const content = await readFile(safePath)
  if (content.length > MAX_IMAGE_BYTES) throw new FileAccessError("La imagen supera el límite de 16 MB.")
  return content
}

export async function writeTextFile(root: string, filePath: string, content: string): Promise<void> {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new FileAccessError("El archivo supera el límite de 2 MB.")
  }

  const safePath = await ensurePhysicallyInsideRoot(root, filePath)

  await mkdir(dirname(safePath), { recursive: true })
  await ensureParentPhysicallyInsideRoot(root, safePath)

  let temporaryPath = ""
  try {
    while (true) {
      temporaryPath = `${safePath}.oec-${randomBytes(12).toString("hex")}.tmp`
      try {
        await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" })
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
    }
    await rename(temporaryPath, safePath)
  } finally {
    if (temporaryPath !== "") await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

export async function createTextFile(root: string, filePath: string): Promise<void> {
  const safePath = await ensurePhysicallyInsideRoot(root, filePath)
  await mkdir(dirname(safePath), { recursive: true })
  await ensureParentPhysicallyInsideRoot(root, safePath)
  try {
    await writeFile(safePath, "", { encoding: "utf8", flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new FileAccessError("Ya existe un archivo con ese nombre.")
    }
    throw error
  }
}

export async function removeProjectEntry(root: string, targetPath: string): Promise<void> {
  const safePath = ensureInsideRoot(root, targetPath)
  if (safePath === resolve(root)) throw new FileAccessError("No se puede eliminar la carpeta raíz del proyecto.")

  await ensureParentPhysicallyInsideRoot(root, safePath)
  const info = await lstat(safePath)
  if (!info.isSymbolicLink()) await ensurePhysicallyInsideRoot(root, safePath)
  await rm(safePath, { recursive: true, force: false })
}
