type ParsedVersion = { core: [number, number, number]; prerelease?: string }

function parseVersion(value: string): ParsedVersion | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value)
  if (!match) return
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] }
}

export function isNewerVersion(current: string, candidate: string): boolean {
  const left = parseVersion(current)
  const right = parseVersion(candidate)
  if (!left || !right) return false
  for (let index = 0; index < left.core.length; index += 1) {
    if (right.core[index] !== left.core[index]) return right.core[index] > left.core[index]
  }
  if (left.prerelease && !right.prerelease) return true
  if (!left.prerelease || !right.prerelease) return false
  return right.prerelease.localeCompare(left.prerelease, "en", { numeric: true }) > 0
}
