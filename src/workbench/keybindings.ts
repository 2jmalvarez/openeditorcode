import type { KeyEvent } from "@opentui/core"

function normalizedName(name: string): string { return name.toLowerCase() === "return" ? "enter" : name.toLowerCase() }

export function matchesBinding(key: KeyEvent, binding: string, ctrl = key.ctrl): boolean {
  const parts = binding.toLowerCase().split("+")
  const name = normalizedName(parts.pop() ?? "")
  if (!name || normalizedName(key.name) !== name) return false
  const requires = (modifier: string) => parts.includes(modifier)
  const alt = key.option || key.meta
  return Boolean(ctrl) === requires("ctrl") && Boolean(key.shift) === requires("shift") && Boolean(alt) === (requires("alt") || requires("meta"))
}

export function bindingLabel(bindings: Record<string, string[]>, command: string, fallback: string): string { return bindings[command]?.map((binding) => binding.replace(/(^|\+)(\w)/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)).join(" / ") || fallback }

export function matchesCommand(key: KeyEvent, bindings: Record<string, string[]>, command: string, fallback: string, ctrl = key.ctrl): boolean {
  const values = bindings[command] ?? [fallback.toLowerCase().replace(/\s/g, "")]
  return values.some((binding) => matchesBinding(key, binding, ctrl))
}
