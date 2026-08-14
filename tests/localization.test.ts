import { expect, test } from "bun:test"
import { configureLanguage, detectSystemLanguage, resolveLanguage, t } from "../src/localization"
import { factoryConfig } from "../src/config/defaults"
import { parseConfig } from "../src/config/schema"
import { parseCli } from "../src/bootstrap/cli"

test("detects supported system languages and falls back to English", () => {
  expect(detectSystemLanguage("es-MX")).toBe("es")
  expect(detectSystemLanguage("en-GB")).toBe("en")
  expect(detectSystemLanguage("fr-FR")).toBe("en")
  expect(resolveLanguage("es", "en-US")).toBe("es")
  expect(resolveLanguage("en", "es-AR")).toBe("en")
  expect(resolveLanguage("auto", "es-AR")).toBe("es")
})

test("accepts legacy configuration as automatic language", () => {
  const config = factoryConfig()
  const legacy = structuredClone(config) as { appearance: { theme: string; language?: string } }
  delete legacy.appearance.language
  expect(parseConfig(JSON.stringify(legacy)).appearance.language).toBe("auto")
})

test("applies the configured language to interface and CLI messages", () => {
  configureLanguage("en")
  expect(t("app.explorer")).toBe("EXPLORER")
  expect(parseCli(["--help"])).toMatchObject({ output: expect.stringContaining("Usage:") })
  configureLanguage("es")
  expect(t("app.explorer")).toBe("EXPLORADOR")
  expect(parseCli(["--help"])).toMatchObject({ output: expect.stringContaining("Uso:") })
})
