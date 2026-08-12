import { createSignal } from "solid-js"
import { countProjectLines, searchProjectText, type ProjectSearchResult } from "./project-search"
import type { Command } from "../dialogs/Overlays"
import { indexFiles } from "./file-index"

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
  let indexPromise: ReturnType<typeof indexFiles> | undefined
  let searchGeneration = 0

  function projectIndex() {
    indexPromise ??= indexFiles(props.root)
    return indexPromise
  }

  function invalidateIndex() {
    searchGeneration += 1
    indexPromise = undefined
    setProjectSearching(false)
  }

  function reset() {
    searchGeneration += 1
    setProjectSearching(false)
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
    const generation = ++searchGeneration
    setProjectSearching(true)
    try {
      const results = await searchProjectText(props.root, query(), 100, await projectIndex())
      if (generation !== searchGeneration) return
      setProjectResults(results)
      setSearchIndex(0)
      props.setStatus(results.length ? `${results.length} coincidencias en el proyecto.` : "No se encontraron coincidencias en el proyecto.")
    } catch {
      if (generation !== searchGeneration) return
      props.setStatus("No se pudo buscar en el proyecto.")
    } finally {
      if (generation === searchGeneration) setProjectSearching(false)
    }
  }

  async function showProjectLineCount() {
    props.setStatus("Calculando líneas del proyecto...")
    try {
      const summary = await countProjectLines(props.root, await projectIndex())
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

  return { query, searchIndex, setSearchIndex, projectResults, projectSearching, lineCounts, reset, updateQuery, findInProject, showProjectLineCount, paletteResults, invalidateIndex }
}
