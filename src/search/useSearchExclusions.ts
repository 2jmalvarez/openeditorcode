import { createMemo, createSignal } from "solid-js"
import { createGitignore, parseGitignore, readGitignoreText } from "../explorer/gitignore"

export type ExclusionSuggestion = {
  pattern: string
  source: "gitignore" | "session" | "project"
  excluded: boolean
}

function normalizePattern(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
}

export function useSearchExclusions(root: string, respectGitignore = true) {
  const [basePatterns, setBasePatterns] = createSignal<string[]>([])
  const [disabledPatterns, setDisabledPatterns] = createSignal<Set<string>>(new Set())
  const [customPatterns, setCustomPatterns] = createSignal<Set<string>>(new Set())
  const [directories, setDirectories] = createSignal<string[]>([])
  let loading: Promise<void> | undefined

  function load() {
    loading ??= readGitignoreText(root).then((text) => { setBasePatterns(parseGitignore(text)) })
    return loading
  }

  async function reload() {
    loading = undefined
    await load()
  }

  const activePatterns = createMemo(() => [
    ...(respectGitignore ? basePatterns().filter((pattern) => !disabledPatterns().has(pattern)) : []),
    ...customPatterns(),
  ])

  function rules() {
    return createGitignore(activePatterns())
  }

  function baseRules() {
    return createGitignore(respectGitignore ? basePatterns() : [])
  }

  function setDirectoryCandidates(values: string[]) {
    setDirectories([...new Set(values.map(normalizePattern).filter((value) => value && value !== ".git" && value !== ".git/").map((value) => value.endsWith("/") ? value : `${value}/`))])
  }

  function suggestions(query: string): ExclusionSuggestion[] {
    const needle = normalizePattern(query).toLocaleLowerCase()
    const output = new Map<string, ExclusionSuggestion>()
    for (const pattern of basePatterns()) {
      const disabled = disabledPatterns().has(pattern)
      output.set(pattern, { pattern, source: "gitignore", excluded: pattern.startsWith("!") ? disabled : !disabled })
    }
    for (const pattern of customPatterns()) output.set(pattern, { pattern, source: "session", excluded: !pattern.startsWith("!") })
    for (const pattern of directories()) if (!output.has(pattern)) output.set(pattern, { pattern, source: "project", excluded: false })
    return [...output.values()]
      .filter((item) => item.pattern !== ".git" && item.pattern !== ".git/" && (!needle || item.pattern.toLocaleLowerCase().includes(needle)))
      .sort((left, right) => Number(right.pattern.toLocaleLowerCase().startsWith(needle)) - Number(left.pattern.toLocaleLowerCase().startsWith(needle)) || left.pattern.localeCompare(right.pattern))
      .slice(0, 80)
  }

  function toggle(patternValue: string) {
    const originalPattern = patternValue.trim()
    const pattern = basePatterns().includes(originalPattern) ? originalPattern : normalizePattern(originalPattern)
    if (!pattern || pattern === ".git" || pattern === ".git/") return false
    if (basePatterns().includes(pattern)) {
      setDisabledPatterns((current) => {
        const next = new Set(current)
        if (next.has(pattern)) next.delete(pattern)
        else next.add(pattern)
        return next
      })
      return true
    }
    setCustomPatterns((current) => {
      const next = new Set(current)
      if (next.has(pattern)) next.delete(pattern)
      else next.add(pattern)
      return next
    })
    return true
  }

  function removeCustom(patternValue: string) {
    const pattern = normalizePattern(patternValue)
    if (!customPatterns().has(pattern)) return false
    setCustomPatterns((current) => {
      const next = new Set(current)
      next.delete(pattern)
      return next
    })
    return true
  }

  return { load, reload, rules, baseRules, activePatterns, basePatterns, disabledPatterns, customPatterns, suggestions, toggle, removeCustom, setDirectoryCandidates }
}
