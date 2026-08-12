import rootPackage from "../package.json"
import linuxPackage from "../packages/oec-linux-x64/package.json"
import windowsPackage from "../packages/oec-win32-x64/package.json"

const failures: string[] = []
const platformPackages = [linuxPackage, windowsPackage]

for (const platformPackage of platformPackages) {
  if (platformPackage.version !== rootPackage.version) {
    failures.push(`${platformPackage.name} is ${platformPackage.version}, expected ${rootPackage.version}`)
  }

  const declaredVersion = rootPackage.optionalDependencies[platformPackage.name as keyof typeof rootPackage.optionalDependencies]
  if (declaredVersion !== rootPackage.version) {
    failures.push(`optional dependency ${platformPackage.name} is ${declaredVersion ?? "missing"}, expected ${rootPackage.version}`)
  }
}

const explicitTag = process.argv[2]
const tag = explicitTag ?? (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined)
if (process.env.GITHUB_REF_TYPE === "tag" && !tag) failures.push("GITHUB_REF_NAME is missing for tag build")
if (tag && tag !== `v${rootPackage.version}`) {
  failures.push(`release tag is ${tag}, expected v${rootPackage.version}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Preflight failed: ${failure}`)
  process.exit(1)
}

console.log(`Release preflight passed for ${rootPackage.version}${tag ? ` (${tag})` : ""}.`)
