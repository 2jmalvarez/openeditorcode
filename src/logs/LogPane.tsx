/** @jsxImportSource @opentui/solid */
import type { KeyEvent, TextareaRenderable } from "@opentui/core"
import { createEffect, onCleanup, type Accessor } from "solid-js"
import type { LogEntry } from "./useLogs"
import { language, t, translateKnown } from "../localization"

type Props = {
  entries: Accessor<LogEntry[]>
  active: Accessor<boolean>
  setViewer: (viewer: TextareaRenderable | undefined) => void
}

function time(entry: LogEntry): string {
  return entry.timestamp.toLocaleTimeString(language(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function logText(entries: LogEntry[]): string {
  if (!entries.length) return t("log.empty")
  return entries.map((entry) => [
    `${time(entry)} · ${translateKnown(entry.source)} · ${translateKnown(entry.operation)}`,
    translateKnown(entry.summary),
    entry.details,
  ].filter(Boolean).join("\n")).join("\n\n")
}

function allowsNavigation(key: KeyEvent): boolean {
  return ["left", "right", "up", "down", "home", "end"].includes(key.name) || (key.ctrl && ["a", "b", "e", "f", "c"].includes(key.name))
}

export function LogPane(props: Props) {
  let viewer: TextareaRenderable | undefined
  const setViewer = (value: TextareaRenderable) => { viewer = value; props.setViewer(value) }
  createEffect(() => viewer?.setText(logText(props.entries())))
  onCleanup(() => props.setViewer(undefined))

  return <box style={{ height: "100%", flexDirection: "column", paddingX: 1 }}>
    <box style={{ height: 1, flexShrink: 0 }}><text fg="#f2c66d"><strong>{t("log.heading")}</strong></text></box>
    <textarea
      ref={setViewer}
      initialValue={logText(props.entries())}
      focused={props.active()}
      wrapMode="word"
      showCursor={false}
      selectionBg="#30404d"
      selectionFg="#ffffff"
      style={{ flexGrow: 1, minHeight: 0, backgroundColor: "#101419", textColor: "#d5dde5" }}
      onKeyDown={(key) => { if (!allowsNavigation(key)) key.preventDefault() }}
      onPaste={(event) => event.preventDefault()}
    />
  </box>
}
