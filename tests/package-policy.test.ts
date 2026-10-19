import { expect, test } from "bun:test"
import { packagePolicies, validatePackageFiles } from "../scripts/package-policy"

test("package allowlists reject secrets, extra files, duplicates, missing and empty entries", () => {
  for (const policy of packagePolicies) {
    const files = policy.required.map((path) => ({ path, size: 1 }))
    expect(() => validatePackageFiles(files, policy.required)).not.toThrow()
    for (const path of [".env", "docs/private.key", "bin/unexpected.js", "../outside"]) {
      expect(() => validatePackageFiles([...files, { path, size: 1 }], policy.required)).toThrow("Unexpected")
    }
    expect(() => validatePackageFiles([...files, files[0]], policy.required)).toThrow("Unexpected")
    expect(() => validatePackageFiles(files.slice(1), policy.required)).toThrow("Missing")
    expect(() => validatePackageFiles([{ ...files[0], size: 0 }, ...files.slice(1)], policy.required)).toThrow("Empty")
  }
})
