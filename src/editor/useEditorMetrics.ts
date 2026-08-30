import type { TextareaRenderable } from "@opentui/core"
import { createSignal, onCleanup } from "solid-js"
import { highlightEditor, type SyntaxTheme } from "./syntax"

type Props = {
  editor: () => TextareaRenderable | undefined
  filePath: () => string | undefined
  content: () => string
  syntaxTheme: () => SyntaxTheme
}

export function visibleLineLabels(sources: number[], wraps: number[], scrollY: number, height: number): string {
  const firstRow = Math.max(0, scrollY)
  return sources.slice(firstRow, firstRow + Math.max(1, height))
    .map((source, index) => wraps[firstRow + index] === 0 ? String(source + 1) : "")
    .join("\n")
}

export function useEditorMetrics(props: Props) {
  const [lineLabels, setLineLabels] = createSignal("1")
  const [scrollbar, setScrollbar] = createSignal("")
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let lineLabelTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let lastScrollY = -1
  let lastWidth = -1
  let lastHeight = -1

  function refresh() {
    const editor = props.editor()
    if (!editor) {
      setLineLabels("1")
      return
    }
    const sources = editor.lineInfo.lineSources
    if (!sources.length) {
      setLineLabels("1")
      return
    }
    const wraps = editor.lineInfo.lineWraps
    const firstRow = Math.max(0, editor.scrollY)
    const visibleRows = Math.max(1, editor.height)
    const labels = visibleLineLabels(sources, wraps, firstRow, visibleRows)
    setLineLabels((current) => current === labels ? current : labels)
    lastScrollY = editor.scrollY
    lastWidth = editor.width
    lastHeight = editor.height
    const totalRows = Math.max(visibleRows, sources.length)
    const maxScroll = totalRows - visibleRows
    const thumbRows = Math.max(1, Math.ceil((visibleRows / totalRows) * visibleRows))
    const maxThumbStart = visibleRows - thumbRows
    const thumbStart = maxScroll === 0 ? 0 : Math.round((editor.scrollY / maxScroll) * maxThumbStart)
    const nextScrollbar = Array.from({ length: visibleRows }, (_, index) => index >= thumbStart && index < thumbStart + thumbRows ? "█" : "│").join("\n")
    setScrollbar((current) => current === nextScrollbar ? current : nextScrollbar)
  }

  function schedule() {
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
    const currentGeneration = generation
    lineLabelTimer = setTimeout(() => {
      if (currentGeneration === generation && props.editor()) refresh()
    }, 16)
  }

  function scheduleHighlight(path: string | undefined, text: string, delay = 120) {
    if (highlightTimer) clearTimeout(highlightTimer)
    const currentGeneration = generation
    highlightTimer = setTimeout(() => {
      const editor = props.editor()
      if (currentGeneration === generation && props.filePath() === path && editor && editor.plainText === text) highlightEditor(editor, path, text, props.syntaxTheme())
    }, delay)
  }

  function reset() {
    generation += 1
    if (highlightTimer) clearTimeout(highlightTimer)
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
    setLineLabels("1")
    setScrollbar("")
    lastScrollY = -1
    lastWidth = -1
    lastHeight = -1
  }

  function syncScroll() {
    const editor = props.editor()
    if (editor && (editor.scrollY !== lastScrollY || editor.width !== lastWidth || editor.height !== lastHeight)) refresh()
  }

  onCleanup(reset)
  return { lineLabels, scrollbar, refresh, schedule, scheduleHighlight, reset, syncScroll }
}
