export function checkReleaseAvailability(version: string, platforms: string[], options?: {
  fetch?: typeof fetch
  signal?: AbortSignal
  includeRoot?: boolean
}): Promise<void>
