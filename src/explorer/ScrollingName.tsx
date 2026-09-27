/** @jsxImportSource @opentui/solid */
import type { BoxRenderable } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js"

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

function nameParts(name: string) {
  const characters = [...segmenter.segment(name)].map((segment) => segment.segment)
  const widths = characters.map((character) => Bun.stringWidth(character))
  return { characters, widths }
}

function lastOffset(widths: number[], width: number) {
  let remaining = widths.reduce((sum, value) => sum + value, 0)
  for (let index = 0; index < widths.length; index += 1) {
    if (remaining <= width) return index
    remaining -= widths[index]!
  }
  return Math.max(0, widths.length - 1)
}

export function visibleName(name: string, width: number, tick: number): string {
  if (width <= 0) return ""
  if (Bun.stringWidth(name) <= width) return name
  const { characters, widths } = nameParts(name)
  const maxOffset = lastOffset(widths, width)
  const offset = Math.min(maxOffset, Math.max(0, tick - 6))
  let result = ""
  let used = 0
  for (let index = offset; index < characters.length; index += 1) {
    if (used + widths[index]! > width) break
    used += widths[index]!
    result += characters[index]
  }
  return result
}

export function ScrollingName(props: { name: string; selected: Accessor<boolean>; active?: Accessor<boolean>; color: string }) {
  const renderer = useRenderer()
  const [width, setWidth] = createSignal(0)
  const [tick, setTick] = createSignal(0)
  const parts = createMemo(() => nameParts(props.name))
  const active = () => props.active?.() ?? true
  let container: BoxRenderable | undefined

  function measure() {
    if (container && container.width !== width()) setWidth(container.width)
  }

  createEffect(() => {
    props.name
    setTick(0)
  })

  createEffect(() => {
    if (!props.selected()) { setTick(0); return }
    renderer.on("frame", measure)
    measure()
    onCleanup(() => renderer.off("frame", measure))
  })

  createEffect(() => {
    if (!props.selected() || !active() || width() <= 0 || Bun.stringWidth(props.name) <= width()) return
    const endpoint = lastOffset(parts().widths, width()) + 6
    if (tick() >= endpoint) return
    const timer = setTimeout(() => setTick((value) => Math.min(endpoint, value + 1)), 150)
    onCleanup(() => clearTimeout(timer))
  })

  return <box ref={container} style={{ width: 0, flexGrow: 1, minWidth: 0, height: 1, overflow: "hidden" }}>
    <text wrapMode="none" style={{ width: "100%" }} fg={props.color}>{props.selected() && width() > 0 ? visibleName(props.name, width(), tick()) : props.name}</text>
  </box>
}
