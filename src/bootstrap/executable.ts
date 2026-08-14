import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { configHash, configPaths, loadConfig, markConfigStarting, readConfigText, restoreFactory } from "../config/storage"

async function runWorker(args: string[], recoveryAttempt = false): Promise<number> {
  const loaded = await loadConfig()
  const text = await readConfigText(loaded.paths)
  if (text === undefined) return 1
  const attemptId = randomUUID()
  await markConfigStarting(loaded.paths, attemptId, text)
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env: { ...process.env, OEC_INTERNAL_WORKER: "1", OEC_CONFIG_ATTEMPT_ID: attemptId },
    })
    child.on("error", () => resolve(1))
    child.on("exit", (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)))
  })
  if (code === 0 || code === 42 || recoveryAttempt) return code
  const current = await readConfigText(loaded.paths)
  try {
    const state = JSON.parse(await Bun.file(loaded.paths.state).text()) as { attemptId?: string; configHash?: string; phase?: string }
    if (current && state.attemptId === attemptId && state.phase === "starting" && state.configHash === configHash(current)) {
      await restoreFactory(loaded.paths, current, "OEC no pudo iniciar con esta configuración.")
      return runWorker(args, true)
    }
  } catch { /* A missing state file means the failure cannot be attributed safely. */ }
  return code
}

if (process.env.OEC_INTERNAL_WORKER === "1") {
  await import("../index")
} else {
  process.exitCode = await runWorker(process.argv.slice(2))
}
