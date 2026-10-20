/** Leave room for the host title, context, six MCP servers, spacing and footer.
 * The host still owns outer scrolling when even the minimum panels cannot fit. */
export function sidebarLayout(rows: number, files: boolean, diff: boolean, diffOpen: boolean, filesOpen = files) {
  const headers = Number(files) + Number(diff) + Number(files && diff)
  const available = Math.max(0, rows - 20 - headers)
  const changes = diff && diffOpen ? Math.max(3, Math.min(8, available - (files && filesOpen ? 3 : 0))) : 0
  return { files: Math.max(3, Math.min(10, available - changes)), changes }
}
