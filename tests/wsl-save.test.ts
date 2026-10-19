import { expect, test } from "bun:test"
import { readFile, readdir, realpath } from "node:fs/promises"
import { join } from "node:path"
import { ExternalFileChangedError, readTextFile, writeTextFile } from "../src/documents/files"
import { readablePowerShellError } from "../src/documents/windows-save"
import { parseWslPath, WslFileChangedError, writeWslFile } from "../src/documents/wsl-save"

test("recognizes only literal WSL redirector paths, including extended UNC", () => {
  expect(parseWslPath("\\\\wsl.localhost\\Ubuntu-24.04\\home\\juan\\file '&.ts")).toEqual({ distribution: "Ubuntu-24.04", path: "/home/juan/file '&.ts" })
  expect(parseWslPath("\\\\wsl$\\Ubuntu\\tmp\\file")).toEqual({ distribution: "Ubuntu", path: "/tmp/file" })
  expect(parseWslPath("\\\\?\\UNC\\wsl.localhost\\Ubuntu\\home\\file")).toEqual({ distribution: "Ubuntu", path: "/home/file" })
  for (const path of ["C:\\file", "/home/file", "\\\\server\\share\\file", "\\\\wsl.localhost.evil\\Ubuntu\\file", "\\\\wsl$\\-bad\\file", "\\\\wsl$\\Ubuntu\\..\\file", "\\\\wsl$\\Ubuntu\\.\\file"]) expect(parseWslPath(path)).toBeUndefined()
})

test("shows readable PowerShell errors rather than CLIXML markup", () => {
  const xml = '#< CLIXML\n<Objs><S S="Error">GetAccessControl: error &quot;1&quot;_x000D__x000A_</S><S S="Error">File retained &amp; edits safe</S></Objs>'
  expect(readablePowerShellError(xml)).toBe('GetAccessControl: error "1"\r\nFile retained & edits safe')
  expect(readablePowerShellError("Plain error\n")).toBe("Plain error")
  expect(readablePowerShellError('#< CLIXML\n<Objs/>')).not.toContain("CLIXML")
})

// Explicit opt-in: no dependency on an installed distro in ordinary CI. This
// exercises actual ext4 through the Windows redirector, not a mock or /mnt/c.
const distribution = process.env.OEC_TEST_WSL_DISTRO
test.skipIf(process.platform !== "win32" || !distribution)("saves real WSL files atomically, retaining native security and rejecting stale/deleted files", async () => {
  const native = async (script: string, ...args: string[]) => {
    const child = Bun.spawn(["wsl.exe", "-d", distribution!, "--exec", "/bin/sh", "-c", script, "oec-test", ...args], { stdout: "pipe", stderr: "pipe" })
    const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    if (code) throw new Error(error)
    return output.trim()
  }
  const linuxRoot = await native("mktemp -d /tmp/oec-wsl-save-XXXXXXXX")
  const root = `\\\\wsl.localhost\\${distribution}${linuxRoot.replace(/\//g, "\\")}`
  const name = "private '& café.txt"
  const path = join(root, name)
  const linuxPath = `${linuxRoot}/${name}`
  try {
    await native('printf original > "$1"; chmod 640 -- "$1"', linuxPath)
    const xattr = await native('if command -v python3 >/dev/null; then python3 -c \'import os,sys; os.setxattr(sys.argv[1], "user.oec-test", b"private-metadata")\' "$1"; printf yes; fi', linuxPath)
    const security = await native('stat -c "%a:%u:%g" -- "$1"', linuxPath)
    expect(parseWslPath(await realpath(path))?.distribution).toBe(distribution!)
    const content = "UTF-8: á漢字\r\n".repeat(20_000)
    await writeTextFile(root, path, content, { expectedContent: "original" })
    expect(await readTextFile(root, path)).toBe(content)
    expect(await native('stat -c "%a:%u:%g" -- "$1"', linuxPath)).toBe(security)
    if (xattr) expect(await native('python3 -c \'import os,sys; print(os.getxattr(sys.argv[1], "user.oec-test").decode())\' "$1"', linuxPath)).toBe("private-metadata")
    expect(await readdir(root)).toEqual([name])
    await expect(writeTextFile(root, path, "stale", { expectedContent: "original" })).rejects.toBeInstanceOf(ExternalFileChangedError)
    await expect(writeWslFile(parseWslPath(root)!, parseWslPath(path)!, "stale", "original")).rejects.toBeInstanceOf(WslFileChangedError)
    expect(await readFile(path, "utf8")).toBe(content)
    await writeTextFile(root, path, "", { expectedContent: content })
    expect(await readFile(path, "utf8")).toBe("")
    expect(await native('stat -c "%a:%u:%g" -- "$1"', linuxPath)).toBe(security)
    await native('chmod 755 -- "$1"', linuxPath)
    await writeTextFile(root.replace("wsl.localhost", "wsl$"), path.replace("wsl.localhost", "wsl$"), "executable", { expectedContent: "" })
    expect(await native('stat -c %a -- "$1"', linuxPath)).toBe("755")
    if (await native("id -u") !== "0") {
      await native('chmod 400 -- "$1"', linuxPath)
      await expect(writeTextFile(root, path, "must not write", { expectedContent: "executable" })).rejects.toThrow("Could not save WSL file")
      expect(await readFile(path, "utf8")).toBe("executable")
      expect(await readdir(root)).toEqual([name])
    }
    await native('rm -- "$1"', linuxPath)
    await expect(writeTextFile(root, path, "must not recreate", { expectedContent: "executable" })).rejects.toBeInstanceOf(ExternalFileChangedError)
    expect(await readdir(root)).toEqual([])
  } finally { await native('rm -rf -- "$1"', linuxRoot) }
}, 60_000)
