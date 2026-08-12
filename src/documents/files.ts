import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"

export const MAX_FILE_BYTES = 2 * 1024 * 1024

export class FileAccessError extends Error {}

export function ensureInsideRoot(root: string, target: string): string {
  const absoluteRoot = resolve(root)
  const absoluteTarget = resolve(target)
  const pathFromRoot = relative(absoluteRoot, absoluteTarget)

  if (pathFromRoot === "" || !pathFromRoot.startsWith("..")) {
    return absoluteTarget
  }

  throw new FileAccessError("La ruta solicitada está fuera de la carpeta abierta.")
}

export async function readTextFile(root: string, filePath: string): Promise<string> {
  const safePath = ensureInsideRoot(root, filePath)
  const info = await stat(safePath)
  if (!info.isFile()) throw new FileAccessError("La ruta seleccionada no es un archivo.")
  if (info.size > MAX_FILE_BYTES) throw new FileAccessError("El archivo supera el límite de 2 MB.")

  const content = await readFile(safePath)
  if (content.includes(0)) throw new FileAccessError("Los archivos binarios no se pueden editar.")
  return content.toString("utf8")
}

export async function writeTextFile(root: string, filePath: string, content: string): Promise<void> {
  const safePath = ensureInsideRoot(root, filePath)
  const temporaryPath = `${safePath}.oec-${process.pid}.tmp`

  await mkdir(dirname(safePath), { recursive: true })
  try {
    await writeFile(temporaryPath, content, "utf8")
    await rename(temporaryPath, safePath)
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
  }
}

export async function createTextFile(root: string, filePath: string): Promise<void> {
  const safePath = ensureInsideRoot(root, filePath)
  await mkdir(dirname(safePath), { recursive: true })
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
  await rm(safePath, { recursive: true, force: false })
}
