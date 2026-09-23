/** @jsxImportSource @opentui/solid */
import { For, Show, type Accessor } from "solid-js"
import type { LogEntry } from "./useLogs"
import { language, t, translateKnown } from "../localization"

type Props = {
  entries: Accessor<LogEntry[]>
  active: Accessor<boolean>
}

function time(entry: LogEntry): string {
  return entry.timestamp.toLocaleTimeString(language(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function LogPane(props: Props) {
  return <box style={{ height: "100%", flexDirection: "column", paddingX: 1 }}>
     <box style={{ height: 1, flexShrink: 0 }}><text fg="#f2c66d"><strong>{t("log.heading")}</strong></text></box>
    <scrollbox focused={props.active()} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0 }}>
       <Show when={props.entries().length} fallback={<text fg="#8ca0ae">{t("log.empty")}</text>}>
        <For each={props.entries()}>{(entry) => <box style={{ flexDirection: "column", marginBottom: 1 }}>
           <text fg="#e68b8b"><strong>{time(entry)} · {translateKnown(entry.source)} · {translateKnown(entry.operation)}</strong></text>
           <text fg="#d5dde5">{translateKnown(entry.summary)}</text>
          <Show when={entry.details}><text fg="#8ca0ae">{entry.details}</text></Show>
        </box>}</For>
      </Show>
    </scrollbox>
  </box>
}
