/** @jsxImportSource @opentui/solid */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { testRender } from "@opentui/solid"
import { App } from "../src/workbench/App"

let root = ""

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "oec-ui-"))
  await writeFile(join(root, "hello.txt"), "contenido de prueba", "utf8")
  await writeFile(join(root, "second.txt"), "segundo archivo", "utf8")
})

afterEach(async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(root, { recursive: true, force: true })
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EBUSY" || attempt === 9) throw error
      await Bun.sleep(50)
    }
  }
})

test("renders the explorer and opens its selected file", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(120)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("hello.txt")

    setup.mockInput.pressEnter()
    await Bun.sleep(120)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("contenido de prueba")
  } finally {
    setup.renderer.destroy()
  }
})

test("opens the command and configuration palette", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    setup.mockInput.pressKey("p", { ctrl: true })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("COMANDOS Y CONFIGURACIÓN")
    expect(setup.captureCharFrame()).toContain("Crear archivo en carpeta seleccionada")
    expect(setup.captureCharFrame()).toContain("Actualizar panel activo")
    expect(setup.captureCharFrame()).toContain("F5")
  } finally {
    setup.renderer.destroy()
  }
})

test("types a local search query and opens its result", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    setup.mockInput.pressKey("f", { ctrl: true })
    await setup.mockInput.typeText("prueba")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("1/1")
    expect(setup.captureCharFrame()).toContain("contenido de prueba")

    setup.mockInput.pressEnter()
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("BUSCAR EN ARCHIVO")
  } finally {
    setup.renderer.destroy()
  }
})

test("opens another file after closing the current tab without a stale save dialog", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("contenido de prueba")

    setup.mockInput.pressKey("w", { ctrl: true })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("OpenEditorCode")
    expect(setup.captureCharFrame()).not.toContain("Hay cambios sin guardar")

    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("contenido de prueba")
  } finally {
    setup.renderer.destroy()
  }
})

test("does not edit a file with navigation and global shortcuts", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    setup.mockInput.pressKey("f", { ctrl: true })
    await setup.renderOnce()
    setup.mockInput.pressKey("escape")
    await setup.renderOnce()
    setup.mockInput.pressKey("tab")
    await setup.renderOnce()
    setup.mockInput.pressArrow("left", { ctrl: true, shift: true })
    await setup.renderOnce()
    setup.mockInput.pressKey("w", { ctrl: true })
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("OpenEditorCode")
    expect(frame).toContain("Archivo cerrado")
    expect(frame).not.toContain("Hay cambios sin guardar")
  } finally {
    setup.renderer.destroy()
  }
})

test("opens a second tab without asking to save the modified first tab", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    await setup.renderOnce()
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.mockInput.typeText("!")
    await setup.renderOnce()

    setup.mockInput.pressArrow("left", { ctrl: true, shift: true })
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    await Bun.sleep(30)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("segundo archivo")
    expect(frame).toContain("hello.txt")
    expect(frame).not.toContain("Hay cambios sin guardar")
  } finally {
    setup.renderer.destroy()
  }
})

test("keeps an inactive modified tab dirty and protects quit", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.mockInput.typeText("!")
    setup.mockInput.pressArrow("left", { ctrl: true, shift: true })
    setup.mockInput.pressArrow("down")
    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.renderOnce()

    expect(setup.captureCharFrame()).toContain("* hello.txt")
    setup.mockInput.pressKey("q", { ctrl: true })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Hay cambios sin guardar")
    expect(setup.captureCharFrame()).toContain("Guardar y salir")
  } finally {
    setup.renderer.destroy()
  }
})

test("does not run global shortcuts behind the command palette", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    setup.mockInput.pressEnter()
    await Bun.sleep(120)
    setup.mockInput.pressKey("p", { ctrl: true })
    setup.mockInput.pressKey("w", { ctrl: true })
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("COMANDOS Y CONFIGURACIÓN")
    expect(frame).toContain("contenido de prueba")
    expect(frame).not.toContain("Archivo cerrado")
  } finally {
    setup.renderer.destroy()
  }
})

test("receives Shift+Enter in the explorer with the extended keyboard protocol", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30, kittyKeyboard: true })
  try {
    await Bun.sleep(30)
    setup.mockInput.pressEnter({ shift: true })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Selecciona una carpeta para contraerla")
  } finally {
    setup.renderer.destroy()
  }
})
