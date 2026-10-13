import { describe, expect, test } from "bun:test"
import { validateBundle, validateManifest, validateTag } from "../scripts/release"
import manifest from "../package.json"

describe("plugin release boundaries", () => {
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
  })
  test("reject checkout imports and host lifecycle ownership", () => {
    const externals = 'import "@opencode/plugin/tui"; import "@opentui/core"; import "@opentui/solid"; import "solid-js";'
    validateBundle(externals)
    for (const code of ['import "../../../../src/index"', 'import "ignore"', 'import(location)', 'renderer.destroy()', 'process.exit(0)', '// node_modules/solid-js/dist/solid.js']) expect(() => validateBundle(externals + "\n" + code)).toThrow()
  })
})
