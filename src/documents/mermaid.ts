import { renderMermaidASCII } from "beautiful-mermaid"

const MAX_MERMAID_SOURCE_LENGTH = 64 * 1024
const mermaidFence = /(^|\r?\n)( {0,3})(`{3,}|~{3,})[^\S\r\n]*mermaid(?:[^\r\n]*)\r?\n([\s\S]*?)\r?\n\3[^\S\r\n]*(?=\r?\n|$)/gi

export function renderMermaidDiagram(source: string): string | undefined {
  if (!source.trim() || source.length > MAX_MERMAID_SOURCE_LENGTH) return undefined

  try {
    return renderMermaidASCII(source, { colorMode: "none", paddingX: 2, paddingY: 1 })
  } catch {
    // Unsupported syntax remains visible through Markdown's normal code-block renderer.
    return undefined
  }
}

export function renderMermaidBlocks(content: string): string {
  return content.replace(mermaidFence, (block, prefix: string, indent: string, fence: string, source: string) => {
    const diagram = renderMermaidDiagram(source)
    return diagram ? `${prefix}${indent}${fence}text\n${diagram}\n${indent}${fence}` : block
  })
}
