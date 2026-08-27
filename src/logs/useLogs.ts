import { createSignal } from "solid-js"

export type LogEntry = {
  id: number
  timestamp: Date
  source: string
  operation: string
  summary: string
  details: string
}

export type LogFailure = Omit<LogEntry, "id" | "timestamp">

const MAX_ENTRIES = 200
const MAX_DETAILS = 12_000

function sanitize(text: string): string {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, MAX_DETAILS)
}

export function useLogs() {
  const [entries, setEntries] = createSignal<LogEntry[]>([])
  const [unreadCount, setUnreadCount] = createSignal(0)
  let nextId = 1

  function report(failure: LogFailure) {
    const entry = { ...failure, id: nextId++, timestamp: new Date(), details: sanitize(failure.details) }
    setEntries((current) => [...current, entry].slice(-MAX_ENTRIES))
    setUnreadCount((count) => count + 1)
  }

  function markRead() { setUnreadCount(0) }

  function notice() {
    const count = unreadCount()
    if (!count) return ""
    return count === 1 ? "Falló una operación · F12 para ver detalles" : `${count} errores sin leer · F12 para ver detalles`
  }

  return { entries, unreadCount, report, markRead, notice }
}
