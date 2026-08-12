import { basename, join } from "node:path"
import { createSignal } from "solid-js"
import { createTextFile, readTextFile, writeTextFile } from "./files"
import type { OpenTab } from "./types"
import type { GitDiff } from "../git/status"

type Props = {
  root: string
  content: () => string
  getText: () => string
  setText: (text: string) => void
  clearEditor: () => void
  blurEditor: () => void
  focusEditor: () => void
  focusExplorer: () => void
  setStatus: (status: string) => void
}

export function useDocuments(props: Props) {
  const [filePath, setFilePath] = createSignal<string>()
  const [tabs, setTabs] = createSignal<OpenTab[]>([])
  const [activeTab, setActiveTab] = createSignal(-1)
  const [savedContent, setSavedContent] = createSignal("")
  const activeDiff = () => {
    const tab = tabs()[activeTab()]
    return tab?.kind === "diff" ? tab.diff : undefined
  }
  const dirty = () => Boolean(filePath()) && props.content() !== savedContent()
  const title = () => filePath() ?? ""

  function syncActiveTab() {
    const index = activeTab()
    if (index < 0) return
    const tab = tabs()[index]
    if (!tab || tab.kind !== "file") return
    const content = props.getText()
    setTabs((current) => current.map((currentTab, tabIndex) => tabIndex === index && currentTab.kind === "file" ? { ...currentTab, content, savedContent: savedContent() } : currentTab))
  }

  function loadTab(index: number, nextTabs = tabs()) {
    const tab = nextTabs[index]
    if (!tab) return
    props.blurEditor()
    setActiveTab(index)
    setFilePath(tab.kind === "file" ? tab.path : undefined)
    setSavedContent(tab.kind === "file" ? tab.savedContent : "")
    props.setText(tab.kind === "file" ? tab.content : "")
    props.focusEditor()
    props.setStatus(tab.kind === "diff" ? `Cambios: ${tab.path}` : `Abierto: ${tab.path}`)
  }

  async function openFile(path: string) {
    try {
      props.blurEditor()
      syncActiveTab()
      const existing = tabs().findIndex((tab) => tab.kind === "file" && tab.path === path)
      if (existing >= 0) return loadTab(existing)
      const content = await readTextFile(props.root, path)
      const nextTabs: OpenTab[] = [...tabs(), { kind: "file", path, content, savedContent: content }]
      setTabs(nextTabs)
      loadTab(nextTabs.length - 1, nextTabs)
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo abrir el archivo.")
    }
  }

  function openDiff(diff: GitDiff) {
    props.blurEditor()
    syncActiveTab()
    const existing = tabs().findIndex((tab) => tab.kind === "diff" && tab.path === diff.file.path)
    if (existing >= 0) {
      setTabs((current) => current.map((tab, index) => index === existing && tab.kind === "diff" ? { ...tab, diff } : tab))
      return loadTab(existing, tabs().map((tab, index) => index === existing && tab.kind === "diff" ? { ...tab, diff } : tab))
    }
    const nextTabs: OpenTab[] = [...tabs(), { kind: "diff", path: diff.file.path, diff }]
    setTabs(nextTabs)
    loadTab(nextTabs.length - 1, nextTabs)
  }

  async function save(): Promise<boolean> {
    const path = filePath()
    if (!path || activeDiff()) {
      props.setStatus("Selecciona un archivo antes de guardar.")
      return false
    }
    try {
      const content = props.getText()
      await writeTextFile(props.root, path, content)
      setSavedContent(content)
      setTabs((current) => current.map((tab, index) => index === activeTab() && tab.kind === "file" ? { ...tab, content, savedContent: content } : tab))
      props.setStatus(`Guardado: ${basename(path)}`)
      return true
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo guardar el archivo.")
      return false
    }
  }

  function closeFile() {
    props.blurEditor()
    const closing = activeTab()
    const nextTabs = tabs().filter((_, index) => index !== closing)
    setTabs(nextTabs)
    if (!nextTabs.length) {
      setActiveTab(-1)
      setFilePath(undefined)
      setSavedContent("")
      props.clearEditor()
      props.focusExplorer()
      props.setStatus("Archivo cerrado.")
      return
    }
    loadTab(Math.min(closing, nextTabs.length - 1), nextTabs)
  }

  function changeTab(direction: number) {
    if (tabs().length < 2) return
    props.blurEditor()
    syncActiveTab()
    loadTab((activeTab() + direction + tabs().length) % tabs().length)
  }

  function activateTab(index: number) {
    if (index === activeTab()) return
    props.blurEditor()
    syncActiveTab()
    loadTab(index)
  }

  async function createFile(directory: string, name: string, refreshExplorer: () => Promise<void>) {
    if (!name) return props.setStatus("Escribe un nombre de archivo.")
    if (name.includes("/") || name.includes("\\")) return props.setStatus("El nombre debe pertenecer a la carpeta seleccionada.")
    const path = join(directory, name)
    try {
      await createTextFile(props.root, path)
      await refreshExplorer()
      await openFile(path)
      props.setStatus(`Creado: ${path}`)
      return true
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo crear el archivo.")
      return false
    }
  }

  return { filePath, tabs, activeTab, activeDiff, dirty, title, openFile, openDiff, save, closeFile, changeTab, activateTab, createFile }
}
