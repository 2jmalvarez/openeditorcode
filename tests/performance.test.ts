import { expect, test } from "bun:test"
import packageJson from "../package.json"
import { visibleLineLabels } from "../src/editor/useEditorMetrics"

test("renders only visible line labels", () => {
  const sources = Array.from({ length: 10_000 }, (_, index) => index)
  const wraps = Array.from({ length: 10_000 }, () => 0)
  const labels = visibleLineLabels(sources, wraps, 5000, 4)
  expect(labels).toBe("5001\n5002\n5003\n5004")
  expect(labels.split("\n")).toHaveLength(4)
})

test("keeps wrapped visual rows aligned", () => {
  expect(visibleLineLabels([0, 0, 1, 2], [0, 1, 0, 0], 0, 4)).toBe("1\n\n2\n3")
})

test("publishes only platform binaries as production dependencies", () => {
  expect(packageJson).not.toHaveProperty("dependencies")
  expect(Object.keys(packageJson.optionalDependencies)).toEqual([
    "@2jmalvarez/oec-linux-x64",
    "@2jmalvarez/oec-win32-x64",
  ])
})
