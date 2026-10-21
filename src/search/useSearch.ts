import { createMemo, createSignal, onCleanup } from "solid-js"
import { filterFilesByContent } from "./content-files"
import { formatNumber, t } from "../localization"
import { countProjectLines, searchProjectText, sortMassiveFiles, type MassiveFile, type ProjectSearchResult } from "./project-search"
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
  respectGitignore?: boolean
  reportError?: (failure: { source: string; operation: string; summary: string; details: string }) => void
}

export function useSearch(props: Props) {
  const [query, setQuery] = createSignal("")
  const [searchIndex, setSearchIndex] = createSignal(0)
  const [projectResults, setProjectResults] = createSignal<ProjectSearchResult[]>([])
  const [projectSearching, setProjectSearching] = createSignal(false)
  const [lineCounts, setLineCounts] = createSignal<Record<string, number>>({})
  const [massiveFiles, setMassiveFiles] = createSignal<MassiveFile[]>([])
  const [fileSearchMode, setFileSearchMode] = createSignal<"name" | "content">("name")
  const [fileSearching, setFileSearching] = createSignal(false)
  const [fileQuery, setFileQuery] = createSignal("")
  const [fileResults, setFileResults] = createSignal<IndexedItem[]>([])
  const [exclusionQuery, setExclusionQuery] = createSignal("")
  const [exclusionIndex, setExclusionIndex] = createSignal(0)
  const exclusions = useSearchExclusions(props.root, props.respectGitignore)
  let indexPromise: ReturnType<typeof buildFileIndex> | undefined
  let searchGeneration = 0
  let fileGeneration = 0
  onCleanup(() => { fileGeneration += 1 })

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
    setFileSearching(false)
    if (clearLineCounts) {
      setLineCounts({})
      setMassiveFiles([])
    }
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
    await props.runActivity(t("search.projectActivity"), async () => {
      try {
        const index = await projectIndex()
        const results = await searchProjectText(props.root, query(), 100, index.items)
        if (generation !== searchGeneration) return
        setProjectResults(results)
        setSearchIndex(0)
        const partial = index.truncated ? t("search.partial", { count: formatNumber(50_000) }) : ""
        props.setStatus(t(results.length === 1 ? "search.oneMatch" : results.length ? "search.matches" : "search.noMatches", { count: formatNumber(results.length) }) + partial)
      } catch (error) {
        if (generation !== searchGeneration) return
        const summary = t("search.failed")
        props.setStatus(summary)
        props.reportError?.({ source: t("log.search"), operation: t("log.projectSearch"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
      } finally {
        if (generation === searchGeneration) setProjectSearching(false)
      }
    })
  }

  async function showProjectLineCount() {
    await props.runActivity(t("search.countActivity"), async () => {
      try {
        await exclusions.load()
        const index = await buildFileIndex(props.root, { rules: exclusions.baseRules() })
        const summary = await countProjectLines(props.root, index.items)
        setLineCounts(summary.byPath)
        props.setStatus(t("search.count", { lines: formatNumber(summary.lines), lineUnit: t(summary.lines === 1 ? "search.lineOne" : "search.lineMany"), files: formatNumber(summary.files), fileUnit: t(summary.files === 1 ? "search.fileOne" : "search.fileMany"), partial: index.truncated ? t("search.partial", { count: formatNumber(50_000) }) : "" }))
      } catch (error) {
        const summary = t("search.countFailed")
        props.setStatus(summary)
        props.reportError?.({ source: t("log.search"), operation: t("log.countLines"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
      }
    })
  }

  async function findMassiveFiles(): Promise<boolean> {
    return await props.runActivity(t("search.massiveActivity"), async () => {
      try {
        // The explorer's mass ranking always follows the project's .gitignore.
        const index = await buildFileIndex(props.root)
        const summary = await countProjectLines(props.root, index.items)
        setLineCounts(summary.byPath)
        const files = sortMassiveFiles(index.items, summary.byPath)
        setMassiveFiles(files)
        props.setStatus(t("search.massiveResult", { count: formatNumber(files.length), partial: index.truncated ? t("search.partial", { count: formatNumber(50_000) }) : "" }))
        return true
      } catch (error) {
        const summary = t("search.massiveFailed")
        props.setStatus(summary)
        props.reportError?.({ source: t("log.explorer"), operation: t("log.massive"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
        return false
      }
    })
  }

  function toggleFileSearchMode() {
    setFileSearchMode((mode) => mode === "name" ? "content" : "name")
    void updateFileQuery(fileQuery())
  }

  function closeFileSearch() {
    fileGeneration += 1
    setFileSearching(false)
    setFileQuery("")
    setFileResults([])
  }

  async function updateFileQuery(value: string) {
    setFileQuery(value)
    const generation = ++fileGeneration
    setFileResults([])
    setFileSearching(false)
    if (!value.trim()) return setFileResults([])
    const mode = fileSearchMode()
    setFileSearching(true)
    if (mode === "content") await new Promise((resolve) => setTimeout(resolve, 150))
    if (generation !== fileGeneration) return
    try {
      const index = await projectIndex()
      if (generation !== fileGeneration) return
      const results = mode === "content"
        ? await filterFilesByContent(props.root, index.items, value, () => generation === fileGeneration)
        : filterItems(props.root, index.items.filter((item) => !item.directory), value, index.items.length)
      if (generation !== fileGeneration) return
      setFileResults(results)
      props.setStatus(t(results.length === 1 ? "search.oneFile" : results.length ? "search.files" : "search.noFiles", { count: formatNumber(results.length) }))
    } catch (error) {
      if (generation !== fileGeneration) return
      const summary = t("search.filesFailed")
      props.setStatus(summary)
      props.reportError?.({ source: t("log.search"), operation: t("log.fileSearch"), summary, details: error instanceof Error ? error.stack ?? error.message : t("log.unknown") })
    } finally {
      if (generation === fileGeneration) setFileSearching(false)
    }
  }

  async function refreshFileSearch() {
    if (fileQuery().trim()) await updateFileQuery(fileQuery())
  }

  const exclusionSuggestions = createMemo(() => exclusions.suggestions(exclusionQuery()))

  async function prepareExclusions() {
    await props.runActivity(t("search.exclusionsActivity"), async () => { await projectIndex() })
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
    if (fileQuery()) await updateFileQuery(fileQuery())
  }

  async function removeExclusion() {
    const pattern = exclusionSuggestions()[exclusionIndex()]?.pattern
    if (!pattern || !exclusions.removeCustom(pattern)) return
    invalidateIndex(false)
    await prepareExclusions()
    if (fileQuery()) await updateFileQuery(fileQuery())
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
    query, searchIndex, setSearchIndex, projectResults, projectSearching, lineCounts, massiveFiles, reset, updateQuery, findInProject, showProjectLineCount, findMassiveFiles, paletteResults, invalidateIndex,
    fileSearchMode, fileSearching, fileQuery, fileResults, toggleFileSearchMode, closeFileSearch, updateFileQuery, refreshFileSearch,
    exclusionQuery, exclusionIndex, setExclusionIndex, exclusionSuggestions, updateExclusionQuery, prepareExclusions, toggleExclusion, removeExclusion, completeExclusion, reloadExclusions,
  }
}
