/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender, useRenderer } from "@opentui/solid"
import type { BoxRenderable } from "@opentui/core"
import { createTranslator, spanish } from "../src/localization"
import { configureLanguage, language } from "../../../src/localization"
import { EditorController } from "../src/integration/controller"
import { parseOptions, parsePreferences } from "../src/integration/options"
import { SessionFiles } from "../src/explorer/SessionFiles"
import { FilesToggle } from "../src/explorer/FilesToggle"
import { SHORTCUTS, configurationText, showSettings } from "../src/integration/reference"
import { mockHost } from "./host"

test("plugin language is scoped, follows auto locale and keeps interpolation values opaque", () => {
  expect(createTranslator("auto", "es-AR").locale).toBe("es")
  expect(createTranslator("auto", "fr-FR").locale).toBe("en")
  const es = createTranslator("es", "en-US")
  const en = createTranslator("en", "es-ES")
  expect(es("OEC · Rename {name}", { name: "Saved" })).toBe("OEC · Renombrar Saved")
  expect(es("Opened /tmp/Saved/Files.txt")).toBe("Abierto /tmp/Saved/Files.txt")
  expect(es("  No changes ")).toBe("  Sin cambios ")
  expect(es("{count} results", { count: 12 })).toBe("12 resultados")
  for (const text of ["constructor", "__proto__", "toString", "unknown {constructor}"]) expect(es(text)).toBe(text)
  const previous = language()
  try {
    configureLanguage("es")
    expect(en.shared("app.noMatches")).toBe("No matches.")
    expect(language()).toBe("es")
  } finally { configureLanguage(previous) }
  expect(es(SHORTCUTS)).toContain("Atajos de OEC")
  expect(es(SHORTCUTS)).not.toContain("show/hide")
  expect(configurationText(parsePreferences({ language: "es" }))).toContain("Valores actuales:")
  expect(configurationText(parsePreferences({ language: "es" }))).toContain('"language": "es"')
  for (const [key, value] of Object.entries(spanish)) {
    expect([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()).toEqual([...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort())
    expect(en(key)).toBe(key)
    expect(es(key)).toBe(value)
  }
})

test("validates auto/en/es preferences", () => {
  expect(parsePreferences({}).language).toBe("auto")
  for (const value of ["en", "es", "auto"] as const) expect(parsePreferences({ language: value }).language).toBe(value)
  for (const value of ["fr", false, 1, ""]) expect(() => parsePreferences({ language: value })).toThrow("language")
  expect(() => parsePreferences({ language: "es", explorerWidth: 2 })).toThrow("debe estar")
})

test("plugin renders translated controls, switches language live and never translates repository or branch names", async () => {
  const root = await mkdtemp(join(tmpdir(), "oec-language-"))
  await writeFile(join(root, "Saved"), "user content")
  const host = mockHost(root)
  const controller = new EditorController(host.context, parseOptions({ localRoot: root, language: "es" }), async () => ({ repository: true,
    repositories: [{ id: "repo", root, name: "Saved", branch: "Files" }], files: [],
  }))
  await controller.toggleFiles()
  const setup = await testRender(() => {
    Object.defineProperty(host.context, "renderer", { value: useRenderer(), configurable: true })
    return <SessionFiles controller={controller} sessionID="session-1" />
  }, { width: 34, height: 30 })
  const frames = async () => { for (let i = 0; i < 5; i++) await setup.renderOnce() }
  try {
    await controller.changes.refresh(); await frames()
    let frame = setup.captureCharFrame()
    expect(frame).toContain("▾ Archivos")
    expect(frame).toContain("▾ Cambios")
    expect(frame).toContain("[Colapsar][Sin salto]")
    expect(frame).toContain("Sin cambios")
    expect(frame).toContain("● ▾ Saved")
    expect(frame).toContain("Files")
    for (const width of [30, 18, 34]) {
      setup.resize(width, 30); await frames()
      const header = setup.renderer.root.findDescendantById("oec-diff-header")!
      const button = setup.renderer.root.findDescendantById("oec-diff-wrap")!
      expect(button.screenY).toBe(header.screenY)
      expect(button.screenX + button.width).toBeLessThanOrEqual(header.screenX + header.width)
      if (width === 30) expect(setup.captureCharFrame()).toContain("[Colapsar] [↵]")
    }
    const pane = setup.renderer.root.findDescendantById("oec-changes-pane")!
    pane.focus(); await frames()
    const layer = [...host.layers].map((factory) => factory()).find((layer) => layer.target?.()?.id === pane.id)!
    expect(layer.commands!.find((command) => command.id?.includes("collapse"))!.title).toContain("Colapsar")
    controller.setLanguage("en"); await frames()
    frame = setup.captureCharFrame()
    expect(frame).toContain("▾ Files")
    expect(frame).toContain("[Collapse] [No wrap]")
    expect(frame).toContain("No changes")
    host.selections.push("language", "es")
    await showSettings(host.context, parsePreferences({}), controller); await frames()
    expect(setup.captureCharFrame()).toContain("[Colapsar]")
  } finally { setup.renderer.destroy(); await controller.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("action buttons show focus feedback and remain keyboard operable", async () => {
  const host = mockHost(process.cwd())
  let activated = 0
  const setup = await testRender(() => <FilesToggle context={host.context} id="button" button label="Collapse" toggle={() => { activated++ }} />, { width: 30, height: 4 })
  try {
    await setup.renderOnce()
    const button = setup.renderer.root.findDescendantById("button") as BoxRenderable
    const background = button.backgroundColor
    expect(setup.captureCharFrame()).toContain("[Collapse]")
    await setup.mockMouse.moveTo(button.screenX + 2, button.screenY); await setup.renderOnce()
    expect(button.backgroundColor).not.toEqual(background)
    await setup.mockMouse.moveTo(29, 3); await setup.renderOnce()
    expect(button.backgroundColor).toEqual(background)
    button.focus(); await setup.renderOnce()
    expect(button.backgroundColor).not.toEqual(background)
    const layer = [...host.layers][0]!()
    await layer.commands!.find((command) => command.bind === "return,space")!.run()
    expect(activated).toBe(1)
  } finally { setup.renderer.destroy() }
})
