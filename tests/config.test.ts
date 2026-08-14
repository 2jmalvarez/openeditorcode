import { afterEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { factoryConfig, serializeConfig } from "../src/config/defaults"
import { parseConfig } from "../src/config/schema"
import { configPaths, loadConfig, saveConfig } from "../src/config/storage"

const directories: string[] = []
async function paths() {
  const directory = await mkdtemp(join(tmpdir(), "oec-config-"))
  directories.push(directory)
  return configPaths({ OEC_CONFIG_DIR: directory }, "win32")
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

test("creates and loads the factory configuration in the user config directory", async () => {
  const target = await paths()
  const loaded = await loadConfig(target)
  expect(loaded.config).toEqual(factoryConfig())
  expect(parseConfig(await readFile(target.file, "utf8"))).toEqual(factoryConfig())
})

test("backs up invalid configuration and always replaces the fixed backup", async () => {
  const target = await paths()
  await writeFile(target.file, "{ invalid", "utf8")
  const first = await loadConfig(target)
  expect(first.recovery?.backup).toBe(target.backup)
  expect(await readFile(target.backup, "utf8")).toBe("{ invalid")

  await writeFile(target.file, '{"schemaVersion":999}', "utf8")
  await loadConfig(target)
  expect(await readFile(target.backup, "utf8")).toBe('{"schemaVersion":999}')
  expect(parseConfig(await readFile(target.file, "utf8"))).toEqual(factoryConfig())
})

test("recovers an invalid UTF-8 configuration through the same backup path", async () => {
  const target = await paths()
  await writeFile(target.file, Buffer.from([0xff, 0xfe]))
  const loaded = await loadConfig(target)
  expect(loaded.recovery).toBeDefined()
  expect(parseConfig(await readFile(target.file, "utf8"))).toEqual(factoryConfig())
})

test("rejects unknown configuration keys without replacing valid saved settings", async () => {
  const target = await paths()
  const config = factoryConfig()
  config.layout.explorerWidth = 48
  await saveConfig(target, serializeConfig(config))
  await expect(saveConfig(target, JSON.stringify({ ...config, extra: true }))).rejects.toThrow("claves")
  expect(parseConfig(await readFile(target.file, "utf8")).layout.explorerWidth).toBe(48)
})

test("migrates schema v1 configuration to preview-enabled schema v2", () => {
  const legacy = factoryConfig() as unknown as Record<string, unknown>
  legacy.schemaVersion = 1
  delete legacy.preview
  expect(parseConfig(JSON.stringify(legacy))).toMatchObject({ schemaVersion: 2, preview: { markdownDefault: "preview", images: true, imageProtocol: "auto" } })
})

test("accepts automatic and explicit language preferences", () => {
  for (const language of ["auto", "es", "en"] as const) {
    const config = factoryConfig()
    config.appearance.language = language
    expect(parseConfig(serializeConfig(config)).appearance.language).toBe(language)
  }
  const config = factoryConfig()
  const invalid = { ...config, appearance: { ...config.appearance, language: "fr" } }
  expect(() => parseConfig(JSON.stringify(invalid))).toThrow()
})
