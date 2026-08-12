import { createSignal } from "solid-js"
import { countProjectLines, searchProjectText, type ProjectSearchResult } from "./project-search"
import type { Command } from "../dialogs/Overlays"

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
}

type Props = {
  root: string
  setStatus: (status: string) => void
}

export function useSearch(props: Props) {
  const [query, setQuery] = createSignal("")
  const [searchIndex, setSearchIndex] = createSignal(0)
  const [projectResults, setProjectResults] = createSignal<ProjectSearchResult[]>([])
  const [projectSearching, setProjectSearching] = createSignal(false)
  const [lineCounts, setLineCounts] = createSignal<Record<string, number>>({})

  function reset() {
    setQuery("")
    setSearchIndex(0)
    setProjectResults([])
  }

  function updateQuery(value: string, clearProjectResults = false) {
    setQuery(value)
    setSearchIndex(0)
    if (clearProjectResults) setProjectResults([])
  }

  async function findInProject() {
    if (!query().trim()) return
    setProjectSearching(true)
    try {
      const results = await searchProjectText(props.root, query())
      setProjectResults(results)
      setSearchIndex(0)
      props.setStatus(results.length ? `${results.length} coincidencias en el proyecto.` : "No se encontraron coincidencias en el proyecto.")
    } catch {
      props.setStatus("No se pudo buscar en el proyecto.")
    } finally {
      setProjectSearching(false)
    }
  }

  async function showProjectLineCount() {
    props.setStatus("Calculando líneas del proyecto...")
    try {
      const summary = await countProjectLines(props.root)
      setLineCounts(summary.byPath)
      props.setStatus(`Proyecto: ${summary.lines.toLocaleString()} líneas en ${summary.files.toLocaleString()} archivos de texto.`)
    } catch {
      props.setStatus("No se pudieron calcular las líneas del proyecto.")
    }
  }

  function paletteResults(commands: Command[]) {
    const needle = normalize(query())
    return commands.filter((command) => normalize(command.title).includes(needle) || normalize(command.shortcut).includes(needle))
  }

  return { query, searchIndex, setSearchIndex, projectResults, projectSearching, lineCounts, reset, updateQuery, findInProject, showProjectLineCount, paletteResults }
}
