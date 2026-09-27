import { expect, test } from "bun:test"
import { renderMermaidBlocks, renderMermaidDiagram } from "../src/documents/mermaid"

test("renders Mermaid flowcharts as terminal Unicode", () => {
  const diagram = renderMermaidDiagram("graph LR\n  Start --> Finish")

  expect(diagram).toContain("Start")
  expect(diagram).toContain("Finish")
  expect(diagram).toContain("┌")
})

test("keeps invalid or oversized Mermaid source available for Markdown code fallback", () => {
  expect(renderMermaidDiagram("not a Mermaid diagram")).toBeUndefined()
  expect(renderMermaidDiagram(`graph TD\n${"A --> B\n".repeat(10_000)}`)).toBeUndefined()
})

test("replaces only valid Mermaid fences before Markdown preview rendering", () => {
  const content = "# Diagram\n\n```mermaid\ngraph LR\n  API --> Database\n```\n\n```ts\nconst untouched = true\n```"
  const preview = renderMermaidBlocks(content)

  expect(preview).toContain("API")
  expect(preview).toContain("Database")
  expect(preview).toContain("┌")
  expect(preview).not.toContain("graph LR")
  expect(preview).toContain("const untouched = true")
})
