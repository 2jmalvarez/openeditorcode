import { checkReleaseAvailability } from "../bin/update-readiness.js"
import manifest from "../package.json"

const platforms = ["@2jmalvarez/oec-win32-x64", "@2jmalvarez/oec-linux-x64"]
const includeRoot = !process.argv.includes("--platforms-only")
const deadline = Date.now() + 10 * 60_000
while (true) {
  try {
    await checkReleaseAvailability(manifest.version, platforms, { includeRoot, signal: AbortSignal.timeout(30_000) })
    console.log(`Public npm metadata and archive URLs ready: ${manifest.version} (${includeRoot ? "all packages" : "both platforms"})`)
    break
  } catch (error) {
    if (Date.now() >= deadline) throw error
    console.log(`Waiting for npm propagation: ${error instanceof Error ? error.message : String(error)}`)
    await Bun.sleep(15_000)
  }
}
