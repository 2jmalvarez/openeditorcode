import { createSignal, onCleanup, onMount } from "solid-js"
import { APP_VERSION } from "../bootstrap/version"
import { isNewerVersion } from "./version"

const UPDATE_URL = "https://registry.npmjs.org/openeditorcode/latest"

export function useUpdates() {
  const [latestVersion, setLatestVersion] = createSignal<string>()
  const launchedByNpm = process.env.OEC_NPM_LAUNCHER === "1"

  onMount(() => {
    const controller = new AbortController()
    let requestTimer: ReturnType<typeof setTimeout> | undefined
    const startTimer = setTimeout(() => {
      requestTimer = setTimeout(() => controller.abort(), 3000)
      void fetch(UPDATE_URL, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : undefined)
        .then((metadata: unknown) => {
          const version = typeof metadata === "object" && metadata && "version" in metadata ? (metadata as { version?: unknown }).version : undefined
          if (typeof version === "string" && isNewerVersion(APP_VERSION, version)) setLatestVersion(version)
        })
        .catch(() => undefined)
        .finally(() => { if (requestTimer) clearTimeout(requestTimer) })
    }, 1000)

    onCleanup(() => {
      clearTimeout(startTimer)
      if (requestTimer) clearTimeout(requestTimer)
      controller.abort()
    })
  })

  return { latestVersion, canUpdate: () => launchedByNpm && Boolean(latestVersion()) }
}
