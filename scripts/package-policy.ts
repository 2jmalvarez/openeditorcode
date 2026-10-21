export type PackFile = { path: string; size: number }

export const packagePolicies = [
  { directory: ".", required: ["bin/oec.js", "bin/launcher.js", "bin/update-readiness.js", "bin/update-readiness.d.ts", "bin/postinstall.js", "docs/manual.md", "docs/security.md", "docs/THIRD-PARTY-NOTICES.txt", "docs/oec-config.schema.json", "docs/images/welcome-screen.png", "docs/images/plugin-screen-1.png", "docs/images/plugin-screen-2.png", "man/oec.1", "man/openeditorcode.1", "LICENSE", "README.md", "README.es.md", "package.json"] },
  { directory: "packages/oec-win32-x64", required: ["bin/oec.exe", "bin/THIRD-PARTY-NOTICES.txt", "LICENSE", "README.md", "package.json"] },
  { directory: "packages/oec-linux-x64", required: ["bin/oec", "bin/THIRD-PARTY-NOTICES.txt", "LICENSE", "README.md", "package.json"] },
]

export function validatePackageFiles(files: PackFile[], allowed: string[]): void {
  const paths = new Set<string>()
  for (const file of files) {
    if (!allowed.includes(file.path) || paths.has(file.path)) throw new Error(`Unexpected package entry: ${file.path}`)
    if (!file.size) throw new Error(`Empty package entry: ${file.path}`)
    paths.add(file.path)
  }
  for (const path of allowed) if (!paths.has(path)) throw new Error(`Missing package entry: ${path}`)
}
