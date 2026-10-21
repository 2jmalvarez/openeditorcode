/** Present common README disclosure wrappers without executing or interpreting HTML. */
export function prepareMarkdown(content: string): string {
  let fence: { marker: string; length: number } | undefined
  return content.split(/\r?\n/).map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
      return line
    }
    if (marker) {
      fence = { marker: marker[1][0], length: marker[1].length }
      return line
    }
    // Only whole, unindented HTML wrapper lines are adapted. Inline and indented
    // code, arbitrary HTML, links and the document's actual contents stay intact.
    if (/^ {0,3}<\/?details(?:\s[^>]*)?>\s*$/i.test(line)) return ""
    const summary = /^ {0,3}<summary(?:\s[^>]*)?>(.+)<\/summary>\s*$/i.exec(line)
    return summary ? `\n**${summary[1].trim()}**\n` : line
  }).join("\n")
}
