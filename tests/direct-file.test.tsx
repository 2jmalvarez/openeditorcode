/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import * as fs from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { KeyCodes } from "@opentui/core/testing"
import { testRender } from "@opentui/solid"
import { App } from "../src/workbench/App"
import { factoryConfig } from "../src/config/defaults"
import { configureLanguage } from "../src/localization"
import * as explorerTree from "../src/explorer/tree"
import * as repositories from "../src/git/repositories"

test("direct file startup opens only the editor and loads each panel independently on demand", async () => {
  configureLanguage("es")
  const root = await mkdtemp(join(tmpdir(), "oec-direct-"))
  const file = join(root, "hello.txt")
  await writeFile(file, "direct file contents")
  await writeFile(join(root, "sibling.txt"), "another file")
  const tree = spyOn(explorerTree, "createTree")
  const discover = spyOn(repositories, "discoverGitRepositories")
  const watch = spyOn(fs, "watch")
  const config = factoryConfig()
  config.updates.checkOnStartup = false
  config.layout.explorerStartup = "visible"
  config.layout.changesStartup = "visible"
  let setup: Awaited<ReturnType<typeof testRender>> | undefined
  try {
    setup = await testRender(() => <App root={root} initialFile={file} config={config} />, { width: 160, height: 30 })
    const waitFor = async (text: string) => {
      for (let attempt = 0; attempt < 80; attempt++) {
        await setup!.renderOnce()
        if (setup!.captureCharFrame().includes(text)) return
        await Bun.sleep(25)
      }
      expect(setup!.captureCharFrame()).toContain(text)
    }
    await waitFor("direct file contents")
    expect(setup.captureCharFrame()).not.toContain("Explorador [Masivos]")
    expect(setup.captureCharFrame()).not.toContain("Mensaje de commit...")
    expect(tree).not.toHaveBeenCalled()
    expect(discover).not.toHaveBeenCalled()
    expect(watch).not.toHaveBeenCalled()
    // Typing works immediately: the selected file, not a hidden panel, owns focus.
    await setup.mockInput.typeText("edited")
    await waitFor("edited")
    expect(tree).not.toHaveBeenCalled()
    expect(discover).not.toHaveBeenCalled()

    setup.mockInput.pressKey(KeyCodes.F7)
    await waitFor("sibling.txt")
    expect(tree).toHaveBeenCalledTimes(1)
    expect(discover).not.toHaveBeenCalled()
    expect(watch).not.toHaveBeenCalled()

    setup.mockInput.pressKey(KeyCodes.F8)
    await waitFor("Esta carpeta no es un repositorio Git.")
    expect(discover).toHaveBeenCalledTimes(1)
    expect(watch).toHaveBeenCalledTimes(1)
    expect(tree).toHaveBeenCalledTimes(1)

    setup.mockInput.pressKey(KeyCodes.F8)
    await setup.renderOnce()
    await writeFile(file, "changed externally")
    await Bun.sleep(500)
    expect(discover).toHaveBeenCalledTimes(1)
    setup.mockInput.pressKey(KeyCodes.F8)
    await setup.renderOnce()
    await Bun.sleep(100)
    expect(discover).toHaveBeenCalledTimes(2)
    expect(watch).toHaveBeenCalledTimes(2)
  } finally {
    setup?.renderer.destroy()
    tree.mockRestore()
    discover.mockRestore()
    watch.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
})

test("opening Changes first discovers real changes without loading Explorer", async () => {
  configureLanguage("es")
  const root = await mkdtemp(join(tmpdir(), "oec-direct-git-"))
  const file = join(root, "hello.txt")
  await writeFile(file, "direct file contents")
  await writeFile(join(root, "untracked.txt"), "a Git change")
  const init = Bun.spawn(["git", "init", root], { stdout: "ignore", stderr: "pipe" })
  expect(await init.exited).toBe(0)
  const tree = spyOn(explorerTree, "createTree")
  const discover = spyOn(repositories, "discoverGitRepositories")
  const config = factoryConfig()
  config.updates.checkOnStartup = false
  let setup: Awaited<ReturnType<typeof testRender>> | undefined
  try {
    setup = await testRender(() => <App root={root} initialFile={file} config={config} />, { width: 100, height: 30 })
    for (let attempt = 0; attempt < 80; attempt++) {
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("direct file contents")) break
      await Bun.sleep(25)
    }
    expect(setup.captureCharFrame()).toContain("direct file contents")
    expect(discover).not.toHaveBeenCalled()
    setup.mockInput.pressKey(KeyCodes.F8)
    for (let attempt = 0; attempt < 80; attempt++) {
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("untracked.txt")) break
      await Bun.sleep(25)
    }
    expect(setup.captureCharFrame()).toContain("untracked.txt")
    expect(discover).toHaveBeenCalledTimes(1)
    expect(tree).not.toHaveBeenCalled()
    setup.mockInput.pressKey(KeyCodes.F7)
    for (let attempt = 0; attempt < 80; attempt++) {
      await setup.renderOnce()
      if (setup.captureCharFrame().includes("Explorador [Masivos]") && tree.mock.calls.length) break
      await Bun.sleep(25)
    }
    expect(tree).toHaveBeenCalledTimes(1)
    expect(setup.captureCharFrame()).not.toContain("Mensaje de commit...")
  } finally {
    setup?.renderer.destroy()
    tree.mockRestore()
    discover.mockRestore()
    await rm(root, { recursive: true, force: true })
  }
})
