/** @jsxImportSource @opentui/solid */
import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { KeyCodes } from "@opentui/core/testing"
import { testRender } from "@opentui/solid"
import { App } from "../src/workbench/App"
import { DiffPane } from "../src/git/DiffPane"
import { configureLanguage } from "../src/localization"

let root = ""

async function git(...args: string[]) {
  const process = Bun.spawn(["git", "-C", root, ...args], { stdout: "ignore", stderr: "pipe" })
  if (await process.exited !== 0) throw new Error(await new Response(process.stderr).text())
}

beforeEach(async () => {
  configureLanguage("es")
  root = await mkdtemp(join(tmpdir(), "oec-ui-"))
  await writeFile(join(root, "hello.txt"), "contenido de prueba", "utf8")
  await writeFile(join(root, "second.txt"), "segundo archivo", "utf8")
})

test("highlights how to open and move between side panels on the welcome screen", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("ABRIR Y MOVERSE ENTRE PANELES")
    expect(frame).toContain("Ctrl+B")
    expect(frame).toContain("MOSTRAR / OCULTAR PANEL IZQUIERDO")
    expect(frame).toContain("Ctrl+Alt+B")
    expect(frame).toContain("MOSTRAR / OCULTAR CAMBIOS")
    expect(frame).toContain("Ctrl+Shift+← / →")
    expect(frame).toContain("MOVERSE ENTRE PANELES")
  } finally {
    setup.renderer.destroy()
  }
})

test("shows only vertical OEC when the welcome area is narrower than the explorer", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 60, height: 24 })
  try {
    await setup.renderOnce()
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).not.toContain("ABRIR Y MOVERSE ENTRE PANELES")
    expect(frame).not.toContain("Ctrl+B")
    expect(frame).toMatch(/│\s+O\s*$/m)
    expect(frame).toMatch(/│\s+E\s*$/m)
    expect(frame).toMatch(/│\s+C\s*$/m)
  } finally {
    setup.renderer.destroy()
  }
})

test("shows both side panels initially when the terminal is wide enough", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 160, height: 30 })
  try {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("EXPLORADOR")
    expect(frame).toContain("Mensaje de commit...")
    expect(frame).toContain("F6 pull | F7 push")
  } finally {
    setup.renderer.destroy()
  }
})

test("renders aligned diff rows with removal and addition markers", async () => {
  const diff = {
    file: { path: "sample.ts", status: "modified" as const, area: "changes" as const, additions: 2, deletions: 1 },
    previous: "before\nconst total = oldValue;\nafter\n",
    current: "before\nconst total = newValue;\ninserted\nafter\n",
  }
  const setup = await testRender(() => <DiffPane diff={() => diff} orientation={() => "horizontal"} stackBelow={() => 120} />, { width: 120, height: 12 })
  try {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("- const total = oldValue;")
    expect(frame).toContain("+ const total = newValue;")
    expect(frame).toContain("+ inserted")
    const backgrounds = setup.captureSpans().lines.flatMap((line) => line.spans.map((span) => span.bg.toInts().slice(0, 3)))
    expect(backgrounds).toContainEqual([239, 123, 123])
    expect(backgrounds).toContainEqual([112, 214, 167])
  } finally {
    setup.renderer.destroy()
  }
})

test("shows only the explorer initially when the terminal is narrow", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 120, height: 30 })
  try {
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("EXPLORADOR")
    expect(frame).not.toContain("CAMBIOS 0")
  } finally {
    setup.renderer.destroy()
  }
})

test("keeps the explorer and hides changes when a wide terminal becomes narrow", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 160, height: 30 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Mensaje de commit...")

    setup.renderer.resize(120, 30)
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("EXPLORADOR")
    expect(frame).not.toContain("CAMBIOS 0")
  } finally {
    setup.renderer.destroy()
  }
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

test("opens the OEC manual as a read-only Markdown preview", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    setup.mockInput.pressKey("p", { ctrl: true })
    await setup.mockInput.typeText("manual")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Abrir manual de OEC")

    setup.mockInput.pressEnter()
    await setup.renderOnce()
    const frame = setup.captureCharFrame()
    expect(frame).toContain("MANUAL DE OEC")
    expect(frame).toContain("SOLO LECTURA")
    expect(frame).not.toContain("# Manual")
  } finally {
    setup.renderer.destroy()
  }
})

test("toggles a Markdown file between preview and source with F4", async () => {
  await writeFile(join(root, "README.md"), "# Documento\n\nContenido fuente", "utf8")
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(80)
    setup.mockInput.pressKey("f", { ctrl: true })
    await setup.mockInput.typeText("README.md")
    await Bun.sleep(80)
    setup.mockInput.pressEnter()
    await Bun.sleep(80)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("PREVIEW MARKDOWN")

    setup.mockInput.pressKey(KeyCodes.F4)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("# Documento")
    expect(setup.captureCharFrame()).not.toContain("PREVIEW MARKDOWN")

    setup.mockInput.pressKey(KeyCodes.F4)
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("PREVIEW MARKDOWN")
  } finally {
    setup.renderer.destroy()
  }
})

test("shows changed file totals, numbering, and line statistics", async () => {
  await git("init", "--quiet")
  await git("config", "user.name", "OEC Tests")
  await git("config", "user.email", "oec@example.test")
  await git("add", ".")
  await git("commit", "--quiet", "-m", "initial")
  await writeFile(join(root, "hello.txt"), "contenido cambiado\notra linea\n", "utf8")

  const setup = await testRender(() => <App root={root} />, { width: 120, height: 30 })
  try {
    setup.mockInput.pressKey("b", { ctrl: true, meta: true })
    let frame = ""
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await Bun.sleep(50)
      await setup.renderOnce()
      frame = setup.captureCharFrame()
      if (frame.includes("CAMBIOS 1") && frame.includes("+2") && frame.includes("-1")) break
    }
    expect(frame).toContain("CAMBIOS 1")
    expect(frame).toContain("1. M")
    expect(frame).toContain("hello.txt")
    expect(frame).toContain("+2")
    expect(frame).toContain("-1")
  } finally {
    setup.renderer.destroy()
  }
})

test("wraps long branch names in the changes panel", async () => {
  const branch = "feature/a-very-long-branch-name-that-must-remain-visible"
  await git("init", "--quiet")
  await git("config", "user.name", "OEC Tests")
  await git("config", "user.email", "oec@example.test")
  await git("add", ".")
  await git("commit", "--quiet", "-m", "initial")
  await git("branch", "-M", branch)

  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    setup.mockInput.pressKey("b", { ctrl: true, meta: true })
    let frame = ""
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await Bun.sleep(50)
      await setup.renderOnce()
      frame = setup.captureCharFrame()
      if (frame.replace(/[^\w/-]/g, "").includes(branch)) break
    }
    expect(frame.replace(/[^\w/-]/g, "")).toContain(branch)
  } finally {
    setup.renderer.destroy()
  }
})

test("types a local search query and opens its result", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(60)
    setup.mockInput.pressEnter()
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await Bun.sleep(40)
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("contenido de prueba")) break
    }
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

test("filters project files with Ctrl+F while the explorer is active", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(80)
    setup.mockInput.pressKey("f", { ctrl: true })
    await setup.mockInput.typeText("second")
    await Bun.sleep(120)
    await setup.renderOnce()

    const searchFrame = setup.captureCharFrame()
    expect(searchFrame).toContain("resultados")
    expect(searchFrame).toContain("second.txt")
    expect(searchFrame).not.toContain("hello.txt")

    setup.mockInput.pressEnter()
    let openedFrame = ""
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await Bun.sleep(40)
      await setup.renderOnce()
      openedFrame = setup.captureCharFrame()
      if (openedFrame.includes("segundo archivo")) break
    }
    expect(openedFrame).toContain("segundo archivo")
    expect(openedFrame).not.toContain("* second.txt")

    setup.mockInput.pressKey("w", { ctrl: true })
    await setup.renderOnce()
    const closedFrame = setup.captureCharFrame()
    expect(closedFrame).toContain("Archivo cerrado")
    expect(closedFrame).not.toContain("Hay cambios sin guardar")
  } finally {
    setup.renderer.destroy()
  }
})

test("cancels explorer file search with Escape and restores its tree", async () => {
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(80)
    setup.mockInput.pressKey("f", { ctrl: true })
    await setup.mockInput.typeText("second")
    await Bun.sleep(80)
    setup.mockInput.pressEscape()
    await Bun.sleep(60)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).not.toContain("Buscar archivo")
    expect(frame).toContain("hello.txt")
    expect(frame).toContain("second.txt")
  } finally {
    setup.renderer.destroy()
  }
})

test("opens session search exclusions from the explorer search", async () => {
  await writeFile(join(root, ".gitignore"), "ignored/\n", "utf8")
  const setup = await testRender(() => <App root={root} />, { width: 100, height: 30 })
  try {
    await Bun.sleep(80)
    setup.mockInput.pressKey("f", { ctrl: true })
    setup.mockInput.pressKey("e", { ctrl: true })
    await Bun.sleep(120)
    await setup.renderOnce()

    const frame = setup.captureCharFrame()
    expect(frame).toContain("EXCLUSIONES DE BÚSQUEDA")
    expect(frame).toContain("ignored/")
    expect(frame).toContain(".gitignore")

    setup.mockInput.pressArrow("down")
    await setup.renderOnce()
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
    await Bun.sleep(120)
    setup.mockInput.pressEnter()
    await Bun.sleep(120)
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
    let frame = ""
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await Bun.sleep(40)
      await setup.renderOnce()
      frame = setup.captureCharFrame()
      if (frame.includes("segundo archivo")) break
    }
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
