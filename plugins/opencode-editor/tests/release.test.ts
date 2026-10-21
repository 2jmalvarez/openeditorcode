import { describe, expect, test } from "bun:test"
import { releaseCommand, testedHostVersions, validateBundle, validateManifest, validateRegistryRevision, validateTag } from "../scripts/release"
import { readFileSync } from "node:fs"
import manifest from "../package.json"
import { validateInstalledNames } from "../scripts/install-check"

describe("plugin release boundaries", () => {
  test("published verification binds to the tag without weakening publication revision checks", () => {
    const release = "8".repeat(40)
    const main = "e".repeat(40)
    expect(() => validateRegistryRevision("after", true, release, release)).not.toThrow()
    expect(() => validateRegistryRevision("after", true, release, main)).toThrow("immutable release tag")
    expect(() => validateRegistryRevision("before", true, release, release)).toThrow("cannot authorize publication")
    expect(() => validateRegistryRevision("before", false, release, main)).toThrow("another revision")
    expect(() => validateRegistryRevision("after", false, release, main)).toThrow("another revision")
    expect(() => validateRegistryRevision("before", false, release, release)).not.toThrow()
    expect(() => validateRegistryRevision("after", true, "invalid", "invalid")).toThrow("immutable release commit")
  })
  test("published-package verification cannot publish or move release tags", () => {
    const workflow = readFileSync(new URL("../../../.github/workflows/verify-published-opencode-editor.yml", import.meta.url), "utf8")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain('tag + "^{commit}"')
    expect(workflow).toContain("plugin:registry after published-package/pack.json --published")
    expect(workflow).not.toContain("GITHUB_SHA:")
    expect(workflow).toContain('OEC_SMOKE_DEBUG: "1"')
    expect(workflow).not.toMatch(/npm publish|git (?:push|tag)|id-token:|contents: write/)
    const actions = [...workflow.matchAll(/uses: (actions\/[^@\s]+)@([a-f0-9]+)/g)]
    for (const [, , sha] of actions) expect(sha).toHaveLength(40)
  })
  test("CI host matrix matches the versions accepted by the host downloader", () => {
    const workflow = readFileSync(new URL("../../../.github/workflows/publish-opencode-editor.yml", import.meta.url), "utf8")
    const matrix = workflow.match(/opencode: (\[[^\n]+\])/)?.[1]
    expect(matrix).toBeDefined()
    expect(JSON.parse(matrix!)).toEqual(testedHostVersions)
    expect(testedHostVersions).toContain("2.1.0")
  })
  test("Windows extraction cannot select Git Bash tar through PATH", () => {
    const args = ["tar", "-xzf", "D:\\a\\host.tgz", "-C", "D:\\a\\host"]
    expect(releaseCommand(args, "win32", "C:\\Windows")).toEqual(["C:\\Windows\\System32\\tar.exe", ...args.slice(1)])
    expect(releaseCommand(args, "win32", "D:\\Windows")[0]).toBe("D:\\Windows\\System32\\tar.exe")
    expect(releaseCommand(args, "linux")).toEqual(args)
    expect(releaseCommand(["git", "status"], "win32")).toEqual(["git", "status"])
  })
  test("independent tags and prereleases", () => {
    expect(validateTag("opencode-editor-v0.1.0", "0.1.0")).toBe("latest")
    expect(validateTag("opencode-editor-v0.1.1-beta.1", "0.1.1-beta.1")).toBe("next")
    for (const tag of ["v0.1.0", "main", "opencode-editor-v0.1.1"]) expect(() => validateTag(tag, "0.1.0")).toThrow()
    expect(() => validateTag("opencode-editor-v0.1.0+build", "0.1.0+build")).toThrow()
    expect(() => validateTag("opencode-editor-v0.1.1-beta.01", "0.1.1-beta.01")).toThrow()
  })
  test("public independent manifest, no lifecycle or host installation", () => {
    validateManifest(manifest)
    expect(() => validateManifest({ ...manifest, private: true })).toThrow()
    expect(() => validateManifest({ ...manifest, scripts: { postinstall: "download" } })).toThrow()
    expect(() => validateManifest({ ...manifest, dependencies: { "solid-js": "1.9.14" } })).toThrow()
    expect(() => validateManifest({ ...manifest, peerDependencies: { ...manifest.peerDependencies, "@opencode/plugin": "^2.0.26" }, peerDependenciesMeta: { ...manifest.peerDependenciesMeta, "@opencode/plugin": { optional: true } } })).toThrow()
  })
  test("installed package must not bring private host runtimes", () => {
    validateInstalledNames([manifest.name])
    for (const host of ["@opencode/plugin", "@opentui/core", "@opentui/solid", "solid-js"]) expect(() => validateInstalledNames([manifest.name, host])).toThrow()
  })
  test("reject checkout imports and host lifecycle ownership", () => {
    const externals = 'import "@opencode/plugin/tui"; import "@opentui/core"; import "@opentui/solid"; import "solid-js";'
    validateBundle(externals)
    for (const code of ['import "../../../../src/index"', 'import "ignore"', 'import(location)', 'renderer.destroy()', 'process.exit(0)', '// node_modules/solid-js/dist/solid.js']) expect(() => validateBundle(externals + "\n" + code)).toThrow()
  })
})
