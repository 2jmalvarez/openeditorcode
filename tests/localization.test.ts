import { expect, test } from "bun:test"
import { configureLanguage, detectSystemLanguage, resolveLanguage, t, translateKnown, formatNumber, messages } from "../src/localization"
import { readGitState } from "../src/git/status"
import { oecManual } from "../src/docs/manual"
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
  expect(t("app.explorer")).toBe("Explorer")
  expect(parseCli(["--help"])).toMatchObject({ output: expect.stringContaining("Usage:") })
  configureLanguage("es")
  expect(t("app.explorer")).toBe("Explorador")
  expect(parseCli(["--help"])).toMatchObject({ output: expect.stringContaining("Uso:") })
})

test("localizes Git errors, retained messages, numbers and the English manual", async () => {
  configureLanguage("es")
  const previous = t("git.notRepository")
  configureLanguage("en")
  try {
    expect(translateKnown(previous)).toBe("This folder is not a Git repository.")
    expect(formatNumber(50_000)).toBe("50,000")
    expect(translateKnown("Proyecto: 50.000 líneas en 1 archivo de texto.")).toBe("Project: 50,000 lines in 1 text file.")
    expect((await readGitState(process.cwd() + "/missing-repository")).message).toBe("This folder is not a Git repository.")
    expect(oecManual("en")).toContain("Git: view commit history")
    expect(oecManual("en")).not.toContain("Git: ver historial")
  } finally { configureLanguage("es") }
})

test("Spanish and English catalogs have the same keys and placeholders", () => {
  expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.es).sort())
  for (const key of Object.keys(messages.es) as Array<keyof typeof messages.es>) {
    const parameters = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
    expect(parameters(messages.en[key])).toEqual(parameters(messages.es[key]))
  }
})
