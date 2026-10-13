import type { Context, Destination, KeymapLayer, Route } from "@opencode/plugin/tui/context"
import { onCleanup } from "solid-js"

/** Minimal host contract, without importing OpenCode runtime or starting a server. */
export function mockHost(root: string) {
  const layers = new Set<() => KeymapLayer>()
  const destinations: Destination[] = []
  const archives = new Map<string, object>()
  const selections: unknown[] = []
  const toasts: string[] = []
  let route: Route = { type: "session", sessionID: "session-1" }
  let mode = "base"
  const context = {
    options: { localRoot: root },
    app: { version: "2.0.26", channel: "stable" },
    theme: { text: { base: "#d6e5dc", muted: "#71808b" }, background: { base: "#101419", raised: { base: "#17202a" } } },
    data: { session: { get: (id: string) => id === "session-1" ? { id, location: { directory: root } } : undefined } },
    ui: {
      router: { current: () => route, navigate: (destination: Destination) => { destinations.push(destination); route = destination.type === "plugin" ? { ...destination, id: "oec.editor" } : destination } },
      dialog: { select: async () => selections.shift(), confirm: async () => selections.shift() },
      toast: { show: (options: { message: string }) => toasts.push(options.message) },
    },
    storage: {
      memory: (_key: string, options: { initial: object }) => [options.initial, () => undefined],
      store: (key: string, options: { initial: object }) => {
        if (!archives.has(key)) archives.set(key, options.initial)
        return [archives.get(key), async (mutate: (value: object) => void) => mutate(archives.get(key)!)]
      },
    },
    keymap: {
      layer: (factory: () => KeymapLayer) => { layers.add(factory); onCleanup(() => layers.delete(factory)) },
      mode: { current: () => mode, push: (next: string) => { const previous = mode; mode = next; return () => { mode = previous } } },
    },
  } as unknown as Context
  return { context, layers, destinations, archives, selections, toasts, mode: () => mode }
}
