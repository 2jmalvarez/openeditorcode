/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, onCleanup, For, Show, type Accessor } from "solid-js"
import { useRenderer } from "@opentui/solid"
import type { FindResult } from "./find"
import { t } from "../localization"

type Props = {
  open: Accessor<boolean>
  query: Accessor<string>
  results: Accessor<FindResult[]>
  index: Accessor<number>
  onQuery: (value: string) => void
  maxWidth: Accessor<number>
}

export function FindPanel(props: Props) {
  const renderer = useRenderer()
  let resultsScroll: ScrollBoxRenderable | undefined
  let pendingScroll: (() => void) | undefined

  function scrollToSelectedResult() {
    const index = props.index()
    if (pendingScroll) renderer.off("frame", pendingScroll)
    pendingScroll = () => {
      renderer.off("frame", pendingScroll!)
      pendingScroll = undefined
      resultsScroll?.scrollChildIntoView(`find-result-${index}`)
    }
    renderer.on("frame", pendingScroll)
  }

  createEffect(() => {
    if (!props.open() || !props.results().length) return
    props.index()
    scrollToSelectedResult()
  })

  onCleanup(() => { if (pendingScroll) renderer.off("frame", pendingScroll) })

  return <Show when={props.open()}>
    <box style={{ position: "absolute", top: 1, right: 2, width: "90%", maxWidth: props.maxWidth(), maxHeight: "65%", padding: 1, flexDirection: "column", backgroundColor: "#1b252e", border: true, borderColor: "#70d6a7", zIndex: 1 }}>
      <box style={{ flexDirection: "row" }}><text fg="#70d6a7">{t("app.findFile")}</text><text style={{ marginLeft: "auto" }} fg="#8ca0ae">{props.results().length ? `${props.index() + 1}/${props.results().length}` : t("app.results", { count: 0 })}</text></box>
      <input focused value={props.query()} onInput={props.onQuery} placeholder={t("app.typeToSearch")} style={{ marginTop: 1, backgroundColor: "#101419" }} />
      <Show when={props.query()} fallback={<text style={{ marginTop: 1 }} fg="#8ca0ae">{t("app.typeTextToSearch")}</text>}>
        <Show when={props.results().length} fallback={<text style={{ marginTop: 1 }} fg="#8ca0ae">{t("app.noMatches")}</text>}>
          <scrollbox ref={(value) => { resultsScroll = value; value.verticalScrollBar.visible = true; scrollToSelectedResult() }} scrollY style={{ flexGrow: 1, minHeight: 0, marginTop: 1 }}>
            <For each={props.results()}>{(result, index) => <box id={`find-result-${index()}`} style={{ backgroundColor: index() === props.index() ? "#28404a" : undefined }}><text fg="#f2c66d">{result.line}:{result.column}</text><text style={{ marginLeft: 1 }} fg="#d6e5dc">{result.preview}</text></box>}</For>
          </scrollbox>
        </Show>
      </Show>
      <text style={{ marginTop: 1 }} fg="#8ca0ae">{t("app.findHelp")}</text>
    </box>
  </Show>
}
