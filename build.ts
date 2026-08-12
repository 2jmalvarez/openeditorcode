import solidPlugin from "@opentui/solid/bun-plugin"

const targets = {
  "win32-x64": { target: "bun-windows-x64", outfile: "packages/oec-win32-x64/bin/oec.exe" },
  "linux-x64": { target: "bun-linux-x64", outfile: "packages/oec-linux-x64/bin/oec" },
} as const

const targetName = process.argv[2] ?? (process.platform === "win32" ? "win32-x64" : "linux-x64")
const target = targets[targetName as keyof typeof targets]

if (!target) {
  console.error(`Unsupported OEC_TARGET: ${targetName}. Use one of: ${Object.keys(targets).join(", ")}.`)
  process.exit(1)
}

const result = await Bun.build({
  entrypoints: ["./src/index.tsx"],
  target: "bun",
  plugins: [solidPlugin],
  compile: {
    target: target.target,
    outfile: target.outfile,
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
