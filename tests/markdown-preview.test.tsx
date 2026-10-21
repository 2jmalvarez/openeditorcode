/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { CodeRenderable, MarkdownRenderable, SyntaxStyle, type Renderable } from "@opentui/core"
import { testRender, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"
import { MarkdownContent, markdownStyles } from "../src/documents/MarkdownContent"
import { prepareMarkdown } from "../src/documents/markdown"

async function finishHighlights(node: Renderable): Promise<void> {
  if (node instanceof CodeRenderable) await node.highlightingDone
  await Promise.all(node.getChildren().map(finishHighlights))
}

test("README disclosure wrappers become readable sections without rewriting code or arbitrary HTML", () => {
  const input = '<details open>\n<summary>Screenshots</summary>\n\n![Example](image.png)\n\n</details>'
  expect(prepareMarkdown(input)).toBe('\n\n**Screenshots**\n\n\n![Example](image.png)\n\n')
  for (const fence of ["```", "~~~~"]) {
    const code = `${fence}html\n<details>\n<summary>Literal</summary>\n</details>\n${fence}`
    expect(prepareMarkdown(code)).toBe(code)
  }
  const literal = '    <details>\n    <summary>Code</summary>\n`<details>`\n<div>HTML</div>\n\\<details>'
  expect(prepareMarkdown(literal)).toBe(literal)
  expect(prepareMarkdown('````html\n```\n<details>\n````\n<summary>Real</summary>')).toContain('<details>\n````\n\n**Real**')
  expect(prepareMarkdown('~~~html\n<summary>Unclosed code</summary>')).toContain('<summary>Unclosed code</summary>')
})

test("Markdown palettes distinguish headings, links, inline code and syntax in light and dark themes", () => {
  for (const light of [false, true]) {
    const colors = { text: light ? "#202020" : "#dddddd", muted: "#888888", surface: light ? "#eeeeee" : "#202020", light }
    const styles = markdownStyles(colors)
    expect(styles.default.fg).toBe(colors.text)
    expect(styles["markup.quote"].fg).toBe(colors.muted)
    expect(styles["markup.heading.1"].bold).toBe(true)
    expect(new Set([1, 2, 3, 4].map((level) => styles[`markup.heading.${level}`].fg)).size).toBe(4)
    expect(styles["markup.link"].underline).toBe(true)
    expect(styles["markup.raw"].bg).toBe(colors.surface)
    expect(styles.keyword.fg).not.toBe(styles.string.fg)
  }
})

test("Markdown uses structured nested lists, quote borders, code panels and fitted tables at narrow widths", async () => {
  const source = '# Heading\n\n## Section\n\n- Parent\n  - Nested child\n\n> Quoted text\n\n```ts\nconst answer = 42\n```\n\n| Name | Value |\n| --- | --- |\n| Example | Wrapped cell text |\n\n<details>\n<summary>More information</summary>\n\nVisible details\n\n</details>'
  const [content, setContent] = createSignal(source)
  const colors = { text: "#d6e5dc", muted: "#8ca0ae", surface: "#151c23" }
  const warnings = spyOn(console, "warn")
  const setup = await testRender(() => {
    const renderer = useRenderer()
    const style = SyntaxStyle.fromStyles(markdownStyles(colors), renderer.nativeScene)
    return <scrollbox width="100%" height="100%" scrollY contentOptions={{ paddingLeft: 2, paddingRight: 2, paddingTop: 1 }}>
      <MarkdownContent id="test-markdown" content={content()} syntaxStyle={style} colors={colors} />
    </scrollbox>
  }, { width: 44, height: 38 })
  try {
    await setup.renderOnce(); await setup.renderOnce()
    for (let attempt = 0; attempt < 100 && !setup.captureCharFrame().includes("Visible details"); attempt++) {
      await Bun.sleep(20); await setup.renderOnce()
    }
    const preview = setup.renderer.root.findDescendantById("test-markdown") as MarkdownRenderable
    expect(preview.internalBlockMode).toBe("top-level")
    expect(preview.width).toBeLessThanOrEqual(40)
    expect(preview.screenX).toBe(2)
    const frame = setup.captureCharFrame()
    expect(frame).toContain("Heading")
    expect(frame).toContain("Nested child")
    expect(frame).toContain("Quoted text")
    expect(frame).toContain("More information")
    expect(frame).toContain("Visible details")
    expect(frame).not.toContain("<details>")
    const lines = frame.split("\n")
    expect(lines.find((line) => line.includes("Nested child"))!.indexOf("Nested child")).toBeGreaterThan(lines.find((line) => line.includes("Parent"))!.indexOf("Parent"))
    expect(preview.tableOptions?.wrapMode).toBe("word")
    const codePanel = preview.getChildren().find((child) => child.id.startsWith("test-markdown-code-"))!
    expect(codePanel).toBeDefined()
    expect(codePanel.getChildren().some((child) => child instanceof CodeRenderable && child.wrapMode === "word")).toBe(true)
    expect((codePanel.getChildren().find((child) => child instanceof CodeRenderable) as CodeRenderable).syntaxStyle).toBe(preview.syntaxStyle)
    expect(source).toContain("<details>")
    await finishHighlights(preview)
    setContent("# Updated\n\n```json\n{\"ok\": true}\n```")
    await setup.renderOnce(); await setup.renderOnce()
    for (let attempt = 0; attempt < 100 && !setup.captureCharFrame().includes("Updated"); attempt++) {
      await Bun.sleep(20); await setup.renderOnce()
    }
    expect(setup.captureCharFrame()).toContain("Updated")
    expect(setup.captureCharFrame()).not.toContain("Nested child")
    await finishHighlights(preview)
    expect(warnings.mock.calls.some(([message]) => String(message).includes("Code highlighting failed"))).toBe(false)
  } finally { setup.renderer.destroy(); warnings.mockRestore() }
})
