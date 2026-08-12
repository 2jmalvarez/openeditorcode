/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, For, Show, type Accessor } from "solid-js"
import type { FindResult } from "./find"

type Props = {
  open: Accessor<boolean>
  query: Accessor<string>
  results: Accessor<FindResult[]>
  index: Accessor<number>
  onQuery: (value: string) => void
}

export function FindPanel(props: Props) {
  let resultsScroll: ScrollBoxRenderable | undefined

  createEffect(() => {
    if (!props.open() || !props.results().length) return
    const index = props.index()
    queueMicrotask(() => resultsScroll?.scrollChildIntoView(`find-result-${index}`))
  })

  return <Show when={props.open()}>
    <box style={{ position: "absolute", top: 1, right: 2, width: 48, maxHeight: "65%", padding: 1, flexDirection: "column", backgroundColor: "#1b252e", border: true, borderColor: "#70d6a7", zIndex: 1 }}>
      <box style={{ flexDirection: "row" }}><text fg="#70d6a7">BUSCAR EN ARCHIVO</text><text style={{ marginLeft: "auto" }} fg="#8ca0ae">{props.results().length ? `${props.index() + 1}/${props.results().length}` : "0 resultados"}</text></box>
      <input focused value={props.query()} onInput={props.onQuery} placeholder="Escribe para buscar..." style={{ marginTop: 1, backgroundColor: "#101419" }} />
      <Show when={props.query()} fallback={<text style={{ marginTop: 1 }} fg="#8ca0ae">Escribe un texto para buscar.</text>}>
        <Show when={props.results().length} fallback={<text style={{ marginTop: 1 }} fg="#8ca0ae">Sin coincidencias.</text>}>
          <scrollbox ref={(value) => { resultsScroll = value; value.verticalScrollBar.visible = true }} scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}>
            <For each={props.results()}>{(result, index) => <box id={`find-result-${index()}`} style={{ backgroundColor: index() === props.index() ? "#28404a" : undefined }}><text fg="#f2c66d">{result.line}:{result.column}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box>}</For>
          </scrollbox>
        </Show>
      </Show>
      <text style={{ marginTop: 1 }} fg="#8ca0ae">Flechas resultado | Enter ir | Esc cerrar</text>
    </box>
  </Show>
}
