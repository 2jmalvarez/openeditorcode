import { createSignal, onCleanup, onMount } from "solid-js"
import { APP_VERSION } from "../bootstrap/version"
import { isNewerVersion } from "./version"
import { checkReleaseAvailability } from "../../bin/update-readiness.js"

const UPDATE_URL = "https://registry.npmjs.org/openeditorcode/latest"

export function useUpdates(checkOnStartup = true) {
  const [latestVersion, setLatestVersion] = createSignal<string>()
  const launchedByNpm = process.env.OEC_NPM_LAUNCHER === "1"

  onMount(() => {
    // Direct binaries must stay on their installation channel, not npm.
    if (!checkOnStartup || !launchedByNpm) return
    const controller = new AbortController()
    let requestTimer: ReturnType<typeof setTimeout> | undefined
    const startTimer = setTimeout(() => {
      requestTimer = setTimeout(() => controller.abort(), 15_000)
      void fetch(UPDATE_URL, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : undefined)
        .then(async (metadata: unknown) => {
          const version = typeof metadata === "object" && metadata && "version" in metadata ? (metadata as { version?: unknown }).version : undefined
          if (typeof version === "string" && isNewerVersion(APP_VERSION, version)) {
            const platform = process.platform === "win32" ? "win32" : process.platform === "linux" ? "linux" : undefined
            if (!platform || process.arch !== "x64") return
            await checkReleaseAvailability(version, [`@2jmalvarez/oec-${platform}-x64`], { signal: controller.signal })
            if (!controller.signal.aborted) setLatestVersion(version)
          }
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
