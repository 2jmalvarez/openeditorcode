import { createMemo, createSignal } from "solid-js"
import { countProjectLines, searchProjectText, type ProjectSearchResult } from "./project-search"
import type { Command } from "../dialogs/types"
import { buildFileIndex, filterItems, relativeResult, type IndexedItem } from "./file-index"
import { useSearchExclusions } from "./useSearchExclusions"

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase()
}

type Props = {
  root: string
  setStatus: (status: string) => void
  runActivity: <T>(message: string, operation: () => Promise<T>) => Promise<T>
}

export function useSearch(props: Props) {
  const [query, setQuery] = createSignal("")
  const [searchIndex, setSearchIndex] = createSignal(0)
  const [projectResults, setProjectResults] = createSignal<ProjectSearchResult[]>([])
  const [projectSearching, setProjectSearching] = createSignal(false)
  const [lineCounts, setLineCounts] = createSignal<Record<string, number>>({})
  const [fileSearchOpen, setFileSearchOpen] = createSignal(false)
  const [fileQuery, setFileQuery] = createSignal("")
  const [fileResults, setFileResults] = createSignal<IndexedItem[]>([])
  const [fileSearchIndex, setFileSearchIndex] = createSignal(0)
  const [exclusionQuery, setExclusionQuery] = createSignal("")
  const [exclusionIndex, setExclusionIndex] = createSignal(0)
  const exclusions = useSearchExclusions(props.root)
  let indexPromise: ReturnType<typeof buildFileIndex> | undefined
  let searchGeneration = 0
  let fileGeneration = 0

  async function projectIndex() {
    await exclusions.load()
    indexPromise ??= buildFileIndex(props.root, { rules: exclusions.rules() })
    const index = await indexPromise
    exclusions.setDirectoryCandidates(index.items.filter((item) => item.directory).map((item) => relativeResult(props.root, item)))
    return index
  }

  function invalidateIndex(clearLineCounts = true) {
    searchGeneration += 1
    fileGeneration += 1
    indexPromise = undefined
    setProjectSearching(false)
    setProjectResults([])
    setFileResults([])
    if (clearLineCounts) setLineCounts({})
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
    await props.runActivity("Buscando en el proyecto...", async () => {
      try {
        const index = await projectIndex()
        const results = await searchProjectText(props.root, query(), 100, index.items)
        if (generation !== searchGeneration) return
        setProjectResults(results)
        setSearchIndex(0)
        const partial = index.truncated ? " Resultado parcial: el índice alcanzó 50.000 entradas." : ""
        props.setStatus((results.length ? `${results.length} coincidencias en el proyecto.` : "No se encontraron coincidencias en el proyecto.") + partial)
      } catch {
        if (generation !== searchGeneration) return
        props.setStatus("No se pudo buscar en el proyecto.")
      } finally {
        if (generation === searchGeneration) setProjectSearching(false)
      }
    })
  }

  async function showProjectLineCount() {
    await props.runActivity("Calculando líneas del proyecto...", async () => {
      try {
        await exclusions.load()
        const index = await buildFileIndex(props.root, { rules: exclusions.baseRules() })
        const summary = await countProjectLines(props.root, index.items)
        setLineCounts(summary.byPath)
        props.setStatus(`Proyecto: ${summary.lines.toLocaleString()} líneas en ${summary.files.toLocaleString()} archivos de texto.${index.truncated ? " Resultado parcial: el índice alcanzó 50.000 entradas." : ""}`)
      } catch {
        props.setStatus("No se pudieron calcular las líneas del proyecto.")
      }
    })
  }

  function openFileSearch() {
    setFileSearchOpen(true)
    setFileQuery("")
    setFileResults([])
    setFileSearchIndex(0)
  }

  function closeFileSearch() {
    fileGeneration += 1
    setFileSearchOpen(false)
    setFileQuery("")
    setFileResults([])
    setFileSearchIndex(0)
  }

  async function updateFileQuery(value: string) {
    setFileQuery(value)
    setFileSearchIndex(0)
    const generation = ++fileGeneration
    if (!value.trim()) return setFileResults([])
    await props.runActivity("Buscando archivos...", async () => {
      try {
        const index = await projectIndex()
        const results = filterItems(props.root, index.items.filter((item) => !item.directory), value)
        if (generation !== fileGeneration) return
        setFileResults(results)
        props.setStatus(results.length ? `${results.length} archivos encontrados.` : "No se encontraron archivos.")
      } catch {
        if (generation === fileGeneration) props.setStatus("No se pudieron buscar archivos.")
      }
    })
  }

  async function refreshFileSearch() {
    if (fileSearchOpen() && fileQuery().trim()) await updateFileQuery(fileQuery())
  }

  function moveFileSelection(direction: number) {
    setFileSearchIndex((value) => Math.max(0, Math.min(value + direction, fileResults().length - 1)))
  }

  const exclusionSuggestions = createMemo(() => exclusions.suggestions(exclusionQuery()))

  async function prepareExclusions() {
    await props.runActivity("Cargando exclusiones de búsqueda...", async () => { await projectIndex() })
    setExclusionIndex((value) => Math.min(value, Math.max(0, exclusionSuggestions().length - 1)))
  }

  function updateExclusionQuery(value: string) {
    setExclusionQuery(value)
    setExclusionIndex(0)
  }

  async function toggleExclusion() {
    const pattern = exclusionSuggestions()[exclusionIndex()]?.pattern ?? exclusionQuery()
    if (!exclusions.toggle(pattern)) return
    invalidateIndex(false)
    await prepareExclusions()
    if (fileSearchOpen() && fileQuery()) await updateFileQuery(fileQuery())
  }

  async function removeExclusion() {
    const pattern = exclusionSuggestions()[exclusionIndex()]?.pattern
    if (!pattern || !exclusions.removeCustom(pattern)) return
    invalidateIndex(false)
    await prepareExclusions()
    if (fileSearchOpen() && fileQuery()) await updateFileQuery(fileQuery())
  }

  function completeExclusion() {
    const pattern = exclusionSuggestions()[exclusionIndex()]?.pattern
    if (pattern) setExclusionQuery(pattern)
  }

  async function reloadExclusions() {
    await exclusions.reload()
    invalidateIndex()
  }

  function paletteResults(commands: Command[]) {
    const needle = normalize(query())
    return commands.filter((command) => normalize(command.title).includes(needle) || normalize(command.shortcut).includes(needle))
  }

  return {
    query, searchIndex, setSearchIndex, projectResults, projectSearching, lineCounts, reset, updateQuery, findInProject, showProjectLineCount, paletteResults, invalidateIndex,
    fileSearchOpen, fileQuery, fileResults, fileSearchIndex, setFileSearchIndex, openFileSearch, closeFileSearch, updateFileQuery, refreshFileSearch, moveFileSelection,
    exclusionQuery, exclusionIndex, setExclusionIndex, exclusionSuggestions, updateExclusionQuery, prepareExclusions, toggleExclusion, removeExclusion, completeExclusion, reloadExclusions,
  }
}
