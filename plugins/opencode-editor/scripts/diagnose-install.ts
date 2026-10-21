import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { inspect } from "node:util"
import { temporary } from "./release"
import { redactSecrets } from "../../../src/logs/redact"

// Diagnostics only: never used as a substitute for fresh-cache TUI smokes.
if (process.argv[2] === "--arborist") {
  try {
    // Match the public host's NpmConfig.load + Npm.reify options.
    // @ts-expect-error npm internal APIs have no declarations.
    const { default: Config } = await import("@npmcli/config")
    // @ts-expect-error npm internal APIs have no declarations.
    const { default: defs } = await import("@npmcli/config/lib/definitions/index.js")
    // @ts-expect-error Arborist has no bundled TypeScript declarations.
    const { Arborist } = await import("@npmcli/arborist")
    const cwd = process.cwd()
    const config = new Config({ npmPath: import.meta.dir, cwd, env: { ...process.env }, argv: [process.execPath, process.execPath, "--prefix", cwd], execPath: process.execPath, platform: process.platform, ...defs, warn: false })
    await config.load()
    console.log(redactSecrets(inspect({ registry: config.flat.registry, proxy: config.flat.proxy, httpsProxy: config.flat.httpsProxy, strictSSL: config.flat.strictSSL, cache: config.flat.cache })))
    process.on("log", (...args) => console.log(redactSecrets(inspect(args, { depth: 5 }))))
    const options = { ...config.flat, audit: false, windowsHide: true }
    await new Arborist({ ...options, path: join(cwd, "staging"), binLinks: true, progress: false, savePrefix: "", ignoreScripts: true }).reify({ ...options, add: [process.argv[3]], save: true, saveType: "prod" })
    console.log("Isolated Arborist installation passed")
  } catch (error) {
    console.error(redactSecrets(inspect(error, { depth: 12 })))
    process.exitCode = 1
  }
} else {
  const [executable, source] = process.argv.slice(2)
  if (!executable || !source) throw new Error("Pass a private host executable and public package spec")
  const sandbox = await temporary("oec-install-diagnostic-")
  try {
    for (const kind of ["host", "arborist"]) {
      const home = join(sandbox, kind)
      await mkdir(home, { recursive: true })
      const env = {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
        TERM: "xterm-256color", TEMP: home, TMP: home, LOCALAPPDATA: home, APPDATA: home, HOME: home, USERPROFILE: home,
        XDG_CONFIG_HOME: join(home, "config"), XDG_DATA_HOME: join(home, "data"), XDG_CACHE_HOME: join(home, "cache"), XDG_STATE_HOME: join(home, "state"),
        OPENCODE_LOG_LEVEL: "DEBUG",
      }
      const trace = join(home, "network.log")
      const args = kind === "host" ? [executable, "plugin", "add", source] : [process.execPath, import.meta.filename, "--arborist", source]
      const traced = process.platform === "linux" && Bun.which("strace")
      const child = Bun.spawn(traced ? [traced, "-f", "-e", "trace=connect", "-o", trace, ...args] : args, { cwd: home, env, stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(100_000) })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      console.log(`${kind} diagnostic exit=${code}\n${redactSecrets(stdout)}\n${redactSecrets(stderr)}`)
      if (traced) console.log(`${kind} connect trace:\n${await readFile(trace, "utf8")}`)
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true })
  }
}
