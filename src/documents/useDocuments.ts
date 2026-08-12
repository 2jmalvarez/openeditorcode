import { basename, join } from "node:path"
import { createSignal } from "solid-js"
import { createTextFile, readTextFile, writeTextFile } from "./files"
import type { OpenTab } from "./types"

type Props = {
  root: string
  getText: () => string
  setText: (text: string) => void
  clearEditor: () => void
  focusEditor: () => void
  focusExplorer: () => void
  setStatus: (status: string) => void
}

export function useDocuments(props: Props) {
  const [filePath, setFilePath] = createSignal<string>()
  const [tabs, setTabs] = createSignal<OpenTab[]>([])
  const [activeTab, setActiveTab] = createSignal(-1)
  const [savedContent, setSavedContent] = createSignal("")
  const dirty = () => Boolean(filePath()) && props.getText() !== savedContent()
  const title = () => filePath() ?? ""

  function syncActiveTab() {
    const index = activeTab()
    if (index < 0) return
    const content = props.getText()
    setTabs((current) => current.map((tab, tabIndex) => tabIndex === index ? { ...tab, content, savedContent: savedContent() } : tab))
  }

  function loadTab(index: number, nextTabs = tabs()) {
    const tab = nextTabs[index]
    if (!tab) return
    setActiveTab(index)
    setFilePath(tab.path)
    setSavedContent(tab.savedContent)
    props.setText(tab.content)
    props.focusEditor()
    props.setStatus(`Abierto: ${tab.path}`)
  }

  async function openFile(path: string) {
    try {
      syncActiveTab()
      const existing = tabs().findIndex((tab) => tab.path === path)
      if (existing >= 0) return loadTab(existing)
      const content = await readTextFile(props.root, path)
      const nextTabs = [...tabs(), { path, content, savedContent: content }]
      setTabs(nextTabs)
      loadTab(nextTabs.length - 1, nextTabs)
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo abrir el archivo.")
    }
  }

  async function save(): Promise<boolean> {
    const path = filePath()
    if (!path) {
      props.setStatus("Selecciona un archivo antes de guardar.")
      return false
    }
    try {
      const content = props.getText()
      await writeTextFile(props.root, path, content)
      setSavedContent(content)
      setTabs((current) => current.map((tab, index) => index === activeTab() ? { ...tab, content, savedContent: content } : tab))
      props.setStatus(`Guardado: ${basename(path)}`)
      return true
    } catch (error) {
      props.setStatus(error instanceof Error ? error.message : "No se pudo guardar el archivo.")
      return false
    }
  }

  function closeFile() {
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
    syncActiveTab()
    loadTab((activeTab() + direction + tabs().length) % tabs().length)
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

  return { filePath, tabs, activeTab, dirty, title, openFile, save, closeFile, changeTab, createFile }
}
