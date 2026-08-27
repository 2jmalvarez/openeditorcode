/** @jsxImportSource @opentui/solid */
import { For, Show, type Accessor } from "solid-js"
import type { LogEntry } from "./useLogs"

type Props = {
  entries: Accessor<LogEntry[]>
  active: Accessor<boolean>
}

function time(entry: LogEntry): string {
  return entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function LogPane(props: Props) {
  return <box style={{ height: "100%", flexDirection: "column", paddingX: 1 }}>
    <box style={{ height: 1, flexShrink: 0 }}><text fg="#f2c66d"><strong>REGISTRO · SOLO LECTURA</strong></text></box>
    <scrollbox focused={props.active()} scrollY verticalScrollbarOptions={{ showArrows: true }} style={{ flexGrow: 1, minHeight: 0 }}>
      <Show when={props.entries().length} fallback={<text fg="#8ca0ae">No hay errores registrados en esta sesión.</text>}>
        <For each={props.entries()}>{(entry) => <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="#e68b8b"><strong>{time(entry)} · {entry.source} · {entry.operation}</strong></text>
          <text fg="#d5dde5">{entry.summary}</text>
          <Show when={entry.details}><text fg="#8ca0ae">{entry.details}</text></Show>
        </box>}</For>
      </Show>
    </scrollbox>
  </box>
}
