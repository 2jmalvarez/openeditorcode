import type { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core"
import { createSignal, onCleanup } from "solid-js"
import { highlightEditor } from "./syntax"

type Props = {
  editor: () => TextareaRenderable | undefined
  filePath: () => string | undefined
  content: () => string
}

export function useEditorMetrics(props: Props) {
  const [lineLabels, setLineLabels] = createSignal("1")
  const [scrollbar, setScrollbar] = createSignal("")
  let lineNumberScroll: ScrollBoxRenderable | undefined
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let lineLabelTimer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let lastScrollY = -1

  function refresh() {
    const editor = props.editor()
    if (!editor) {
      setLineLabels("1")
      return
    }
    const sources = editor.lineInfo.lineSources
    if (!sources.length) {
      setLineLabels(props.content().split("\n").map((_, index) => String(index + 1)).join("\n"))
      return
    }
    const wraps = editor.lineInfo.lineWraps
    setLineLabels(sources.map((source, index) => wraps[index] === 0 ? String(source + 1) : "").join("\n"))
    lineNumberScroll?.scrollTo({ x: 0, y: editor.scrollY })
    lastScrollY = editor.scrollY
    const visibleRows = Math.max(1, editor.height)
    const totalRows = Math.max(visibleRows, editor.lineCount)
    const maxScroll = totalRows - visibleRows
    const thumbRows = Math.max(1, Math.ceil((visibleRows / totalRows) * visibleRows))
    const maxThumbStart = visibleRows - thumbRows
    const thumbStart = maxScroll === 0 ? 0 : Math.round((editor.scrollY / maxScroll) * maxThumbStart)
    setScrollbar(Array.from({ length: visibleRows }, (_, index) => index >= thumbStart && index < thumbStart + thumbRows ? "█" : "│").join("\n"))
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
      if (currentGeneration === generation && props.filePath() === path && editor && editor.plainText === text) highlightEditor(editor, path, text)
    }, delay)
  }

  function reset() {
    generation += 1
    if (highlightTimer) clearTimeout(highlightTimer)
    if (lineLabelTimer) clearTimeout(lineLabelTimer)
    setLineLabels("1")
    setScrollbar("")
  }

  function syncScroll() {
    const editor = props.editor()
    if (editor && editor.scrollY !== lastScrollY) refresh()
  }

  onCleanup(reset)
  return { lineLabels, scrollbar, setLineNumberScroll: (value: ScrollBoxRenderable) => { lineNumberScroll = value }, refresh, schedule, scheduleHighlight, reset, syncScroll }
}
