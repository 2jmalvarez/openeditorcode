import { createHash } from "node:crypto"
import { join } from "node:path"

export type WslPath = { distribution: string; path: string }

/** Only the WSL filesystem redirector, never arbitrary UNC/network shares. */
export function parseWslPath(path: string): WslPath | undefined {
  const normalized = path.replace(/^\\\\\?\\UNC\\/i, "\\\\")
  const match = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(\\.*)?$/i.exec(normalized)
  if (!match || !/^[\w.-]+$/.test(match[1]!) || match[1]!.startsWith("-")) return
  const linuxPath = (match[2] || "\\").replace(/\\/g, "/")
  if (linuxPath.includes("\0") || linuxPath.split("/").some((part) => part === ".." || part === ".")) return
  return { distribution: match[1]!, path: linuxPath }
}

export class WslFileChangedError extends Error {}

// Arguments are separate from shell source. Native coreutils preserve Linux
// ownership, mode and ACL/xattrs before any content enters the temporary file.
// Read an exact byte count: embedded Bun hosts may keep stdin open indefinitely.
export const wslSaveScript = `set -eu
root=$(realpath -e -- "$1")
root=\${root%/}
parent=$(realpath -e -- "$(dirname -- "$2")")
target="$parent/$(basename -- "$2")"
case "$target" in "$root"/*) ;; *) echo 'File is outside the project root' >&2; exit 1;; esac
expected=$4
check_expected() {
  if [ -n "$expected" ]; then
    [ -f "$target" ] || exit 73
    actual=$(sha256sum -- "$target")
    [ "\${actual%% *}" = "$expected" ] || exit 73
  fi
}
check_expected
[ ! -L "$target" ] || { echo 'Refusing to replace a symbolic link' >&2; exit 1; }
umask 077
temporary=$(mktemp -- "$parent/.oec-save-XXXXXXXXXXXX")
trap 'rm -f -- "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
if [ -e "$target" ]; then
  cp --attributes-only --preserve=mode,ownership,xattr -- "$target" "$temporary"
fi
head -c "$3" > "$temporary"
[ "$(stat -c %s -- "$temporary")" = "$3" ] || { echo 'Incomplete UTF-8 input; original file retained' >&2; exit 1; }
sync -f -- "$temporary"
check_expected
mv -fT -- "$temporary" "$target"
`

export async function writeWslFile(root: WslPath, target: WslPath, content: string, expectedContent?: string): Promise<void> {
  if (root.distribution.toLowerCase() !== target.distribution.toLowerCase()) throw new Error("WSL file is outside the project distribution")
  const bytes = new TextEncoder().encode(content)
  const expected = expectedContent === undefined ? "" : createHash("sha256").update(expectedContent, "utf8").digest("hex")
  const executable = join(process.env.SystemRoot || "C:\\Windows", "System32", "wsl.exe")
  const child = Bun.spawn([executable, "--distribution", target.distribution, "--exec", "/bin/sh", "-c", wslSaveScript, "oec-save", root.path, target.path, String(bytes.byteLength), expected], {
    stdin: bytes, stdout: "ignore", stderr: "pipe", windowsHide: true,
  })
  const timer = setTimeout(() => child.kill(), 15_000)
  try {
    const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()])
    if (code === 73) throw new WslFileChangedError("File changed or was deleted on disk")
    if (code !== 0) throw new Error(`Could not save WSL file; local edits retained. ${error.trim() || "WSL save timed out or failed"}`)
  } finally { clearTimeout(timer) }
}
