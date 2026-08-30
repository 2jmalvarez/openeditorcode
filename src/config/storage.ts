import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { factoryConfig, serializeConfig } from "./defaults"
import { parseConfig, parseProjectConfig, resolveConfig } from "./schema"
import type { ConfigPaths, ConfigRecovery, OecConfig, ProjectConfig } from "./types"
import { t } from "../localization"

const MAX_CONFIG_BYTES = 256 * 1024

export function configPaths(env = process.env, platform = process.platform): ConfigPaths {
  const directory = env.OEC_CONFIG_DIR || (platform === "win32"
    ? join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "openeditorcode")
    : join(env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config"), "openeditorcode"))
  return { directory, file: join(directory, "config.json"), backup: join(directory, "config.bkp.json"), state: join(directory, "startup-state.json"), notice: join(directory, "recovery-notice.json") }
}

export function projectConfigPath(root: string): string { return join(root, ".oec", "config.json") }

export async function atomicWrite(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.oec-${randomBytes(12).toString("hex")}.tmp`
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" })
    await rename(temporary, file)
  } finally { await rm(temporary, { force: true }).catch(() => undefined) }
}

export async function readConfigText(paths: ConfigPaths): Promise<string | undefined> {
  try {
    const bytes = await readFile(paths.file)
    if (bytes.length > MAX_CONFIG_BYTES) throw new Error(t("config.tooLarge"))
    // Invalid UTF-8 becomes invalid JSON below, so it follows the same backup and recovery path.
    return new TextDecoder("utf-8").decode(bytes)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

export async function restoreFactory(paths: ConfigPaths, original: string, reason: string): Promise<ConfigRecovery> {
  await atomicWrite(paths.backup, original)
  await atomicWrite(paths.file, serializeConfig(factoryConfig()))
  const recovery = { reason, backup: paths.backup }
  await atomicWrite(paths.notice, JSON.stringify(recovery))
  return recovery
}

export async function loadConfig(paths = configPaths()): Promise<{ config: OecConfig; paths: ConfigPaths; recovery?: ConfigRecovery }> {
  const text = await readConfigText(paths)
  if (text === undefined) {
    const config = factoryConfig()
    await atomicWrite(paths.file, serializeConfig(config))
    return { config, paths, recovery: await readRecoveryNotice(paths) }
  }
  try { return { config: parseConfig(text), paths, recovery: await readRecoveryNotice(paths) } } catch (error) {
    const recovery = await restoreFactory(paths, text, error instanceof Error ? error.message : t("config.invalid"))
    return { config: factoryConfig(), paths, recovery }
  }
}

export async function saveConfig(paths: ConfigPaths, text: string): Promise<OecConfig> {
  if (Buffer.byteLength(text, "utf8") > MAX_CONFIG_BYTES) throw new Error(t("config.tooLarge"))
  const config = parseConfig(text)
  await atomicWrite(paths.file, serializeConfig(config))
  return config
}

export async function loadProjectConfig(root: string): Promise<{ config?: ProjectConfig; path: string }> {
  const path = projectConfigPath(root)
  try { return { config: parseProjectConfig(await readFile(path, "utf8")), path } } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path }
    throw error
  }
}

export async function saveProjectConfig(root: string, text: string): Promise<ProjectConfig> {
  const config = parseProjectConfig(text)
  await atomicWrite(projectConfigPath(root), `${JSON.stringify(config, null, 2)}\n`)
  return config
}

export { resolveConfig }

export function configHash(text: string): string { return createHash("sha256").update(text).digest("hex") }

type StartupState = { attemptId: string; configHash: string; phase: "starting" | "healthy" }

export async function markConfigStarting(paths: ConfigPaths, attemptId: string, text: string): Promise<void> {
  await atomicWrite(paths.state, JSON.stringify({ attemptId, configHash: configHash(text), phase: "starting" } satisfies StartupState))
}

export async function markConfigHealthy(paths: ConfigPaths, attemptId: string): Promise<void> {
  try {
    const state = JSON.parse(await readFile(paths.state, "utf8")) as Partial<StartupState>
    if (state.attemptId !== attemptId || state.phase !== "starting") return
    await atomicWrite(paths.state, JSON.stringify({ attemptId, configHash: state.configHash!, phase: "healthy" } satisfies StartupState))
  } catch { /* Startup recovery is best effort once rendering succeeded. */ }
}

export async function readRecoveryNotice(paths: ConfigPaths): Promise<ConfigRecovery | undefined> {
  try {
    const value = JSON.parse(await readFile(paths.notice, "utf8")) as Partial<ConfigRecovery>
    return typeof value.reason === "string" && typeof value.backup === "string" ? { reason: value.reason, backup: value.backup } : undefined
  } catch { return undefined }
}

export async function clearRecoveryNotice(paths: ConfigPaths): Promise<void> { await rm(paths.notice, { force: true }) }
