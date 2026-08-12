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
  await rm(root, { recursive: true, force: true })
})

test("renders the explorer and opens its selected file", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("hello.txt")

    setup.mockInput.pressEnter()
    await Bun.sleep(60)
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
    expect(setup.captureCharFrame()).toContain("Actualizar explorador")
    expect(setup.captureCharFrame()).toContain("F5")
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
    expect(setup.captureCharFrame()).toContain("Sin archivo abierto")
    expect(setup.captureCharFrame()).not.toContain("Hay cambios sin guardar")

    setup.mockInput.pressEnter()
    await Bun.sleep(60)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("contenido de prueba")
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

    setup.mockInput.pressKey("b", { ctrl: true })
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
