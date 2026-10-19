import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { builtinModules } from "node:module"
import { join, resolve, win32 } from "node:path"
import ts from "typescript"

export const directory = resolve(import.meta.dir, "..")
export const root = resolve(directory, "../..")
export const registry = "https://registry.npmjs.org"
export const name = "@2jmalvarez/opencode-editor"
export const allowedFiles = ["LICENSE", "README.md", "dist/tui.js", "package.json", "tui.ts"]
export const hostPackages = ["@opencode/plugin", "@opentui/core", "@opentui/solid", "solid-js"]

export async function temporary(prefix: string) {
  const base = process.env.OEC_SMOKE_TEMP ?? (process.platform === "win32" ? join(process.env.LOCALAPPDATA!, "Temp", "opencode") : tmpdir())
  await mkdir(base, { recursive: true })
  return mkdtemp(join(base, prefix))
}

export function releaseCommand(args: string[], platform: NodeJS.Platform = process.platform, systemRoot = process.env.SystemRoot ?? "C:\\Windows") {
  // Git Bash puts GNU tar ahead of Windows tar. GNU tar treats D:\\... as a
  // remote archive (host D), so never resolve this executable through PATH.
  return platform === "win32" && args[0] === "tar" ? [win32.join(systemRoot, "System32", "tar.exe"), ...args.slice(1)] : args
}

export async function command(args: string[], cwd = root) {
  const child = Bun.spawn(releaseCommand(args), { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code !== 0) throw new Error(`${args[0]} failed (${code}): ${stderr}\n${stdout}`)
  return stdout.trim()
}

export function npm(args: string[], cwd?: string) {
  // Bun can invoke npm.cmd directly on Windows, including paths containing spaces.
  return command([process.platform === "win32" ? "npm.cmd" : "npm", ...args], cwd)
}

export function validateTag(tag: string, version: string) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/, "Build metadata is not supported in release versions")
  const prerelease = version.split(/-(.*)/s)[1]
  if (prerelease) for (const identifier of prerelease.split(".")) assert.ok(!/^0\d+$/.test(identifier), "Numeric prerelease identifiers must not have leading zeroes")
  assert.equal(tag, `opencode-editor-v${version}`, "Tag must exactly match the plugin version")
  return version.includes("-") ? "next" : "latest"
}

export function validateManifest(manifest: Record<string, any>) {
  assert.equal(manifest.name, name)
  assert.notEqual(manifest.private, true)
  validateTag(`opencode-editor-v${manifest.version}`, manifest.version)
  assert.equal(manifest.type, "module")
  assert.deepEqual(manifest.exports, { "./tui": "./dist/tui.js" })
  assert.deepEqual(manifest.files, ["dist/tui.js", "tui.ts", "README.md", "LICENSE"])
  assert.equal(manifest.publishConfig?.access, "public")
  assert.equal(manifest.publishConfig?.registry, registry)
  assert.equal(manifest.repository?.url, "git+https://github.com/2jmalvarez/openeditorcode.git")
  assert.equal(manifest.repository?.directory, "plugins/opencode-editor")
  assert.equal(manifest.license, "MIT")
  assert.equal(manifest.engines?.bun, ">=1.3.14")
  assert.ok(!manifest.scripts, "The published package must not run lifecycle scripts")
  for (const key of ["dependencies", "optionalDependencies", "bundledDependencies", "devDependencies"]) assert.ok(!manifest[key], `Unexpected ${key}; host runtimes must remain external`)
  assert.deepEqual(Object.keys(manifest.peerDependencies).sort(), [...hostPackages].sort())
  for (const host of hostPackages) assert.equal(manifest.peerDependenciesMeta?.[host]?.optional, true, "Host peers must not be auto-installed as private copies")
  for (const version of ["2.0.26", "2.0.27"]) assert.ok(Bun.semver.satisfies(version, manifest.peerDependencies["@opencode/plugin"]))
  for (const host of ["@opentui/core", "@opentui/solid"]) {
    assert.ok(Bun.semver.satisfies("0.5.17", manifest.peerDependencies[host]))
    assert.ok(!Bun.semver.satisfies("0.6.0", manifest.peerDependencies[host]))
  }
}

export function validateBundle(code: string) {
  const file = ts.createSourceFile("tui.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const imports = new Set<string>()
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.add(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!), "Non-literal runtime import")
      imports.add((node.arguments[0] as ts.StringLiteral).text)
    }
    if (ts.isStringLiteral(node)) assert.ok(!/(?:\.\.\/){2,}src|[A-Za-z]:[\\/].*(?:openeditorcode|node_modules)|\/home\/runner\/work\//i.test(node.text), `Checkout reference: ${node.text}`)
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const specifier of imports) assert.ok(builtinModules.includes(specifier.replace(/^node:/, "")) || hostPackages.some((host) => specifier === host || specifier.startsWith(`${host}/`)), `Unbundled dependency: ${specifier}`)
  for (const host of hostPackages) assert.ok([...imports].some((specifier) => specifier === host || specifier.startsWith(`${host}/`)), `Missing external ${host}`)
  assert.ok(!/\/\/ (?:node_modules\/(?:solid-js|@opentui|@opencode)|src\/(?:index\.tsx|bootstrap\/))/.test(code), "Host runtime or autonomous bootstrap bundled")
  assert.ok(!/createCliRenderer|process\.exit\(|renderer\.destroy\(/.test(code), "Plugin must not own host lifecycle")
  return [...imports].sort()
}

export function integrity(bytes: Uint8Array) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`
}

export async function metadata(packageName: string, version: string): Promise<Record<string, any> | null> {
  const response = await fetch(`${registry}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(30_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Registry returned ${response.status}; do not treat this as an absent version`)
  return response.json()
}

export async function download(manifest: Record<string, any>, destination: string) {
  assert.ok(manifest.dist?.tarball.startsWith(`${registry}/`), "Unexpected tarball origin")
  const response = await fetch(manifest.dist.tarball, { signal: AbortSignal.timeout(60_000) })
  assert.ok(response.ok, `Tarball HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.equal(integrity(bytes), manifest.dist.integrity, "Downloaded tarball integrity mismatch")
  await Bun.write(destination, bytes)
}
