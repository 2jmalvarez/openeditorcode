import { join } from "node:path"

// Paths travel through the environment, never PowerShell source. Apply the ACL
// before copying a single byte of content; ReplaceFile preserves the target ACL.
// Use Framework APIs without module discovery, and read exactly the encoded
// byte count: embedded Bun hosts may keep the stdin pipe open after writing.
const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$PSModuleAutoLoadingPreference = 'None'
[Console]::Error.WriteLine('Windows save: reading security descriptor')
$source = $env:OEC_SAVE_TEMP
$target = $env:OEC_SAVE_TARGET
$exists = [IO.File]::Exists($target)
if ($exists) {
  $acl = [IO.File]::GetAccessControl($target)
} else {
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow')
  $acl.AddAccessRule($rule)
}
[Console]::Error.WriteLine('Windows save: securing temporary file')
[IO.File]::SetAccessControl($source, $acl)
$output = [IO.File]::Open($source, [IO.FileMode]::Open, [IO.FileAccess]::Write)
try {
  [Console]::Error.WriteLine('Windows save: receiving UTF-8 content')
  $remaining = [long]::Parse($env:OEC_SAVE_BYTES)
  $inputStream = [Console]::OpenStandardInput()
  $buffer = [byte[]]::new(65536)
  while ($remaining -gt 0) {
    $count = $inputStream.Read($buffer, 0, [int][Math]::Min($remaining, $buffer.Length))
    if ($count -le 0) { throw 'Unexpected end of UTF-8 input; original file retained' }
    $output.Write($buffer, 0, $count)
    $remaining -= $count
  }
  $output.Flush($true)
} finally { $output.Dispose() }
[Console]::Error.WriteLine('Windows save: replacing target')
if ($exists) { [IO.File]::Replace($source, $target, [NullString]::Value) }
else { [IO.File]::Move($source, $target) }
`

// PowerShell 7 -> Bun -> Windows PowerShell otherwise passes PS7-only modules
// to the .NET Framework host. Let powershell.exe construct its own module path.
export function windowsPowerShellEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(environment).filter(([key]) => key.toUpperCase() !== "PSMODULEPATH"))
}

export async function writeAndReplaceWindowsFile(temporary: string, target: string, content: string): Promise<void> {
  const powershell = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  const bytes = new TextEncoder().encode(content)
  const child = Bun.spawn([powershell, "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    env: { ...windowsPowerShellEnvironment(process.env), OEC_SAVE_TEMP: temporary, OEC_SAVE_TARGET: target, OEC_SAVE_BYTES: String(bytes.byteLength) },
    stdin: bytes, stdout: "ignore", stderr: "pipe", windowsHide: true,
  })
  const timer = setTimeout(() => child.kill(), 15_000)
  try {
    const [exit, error] = await Promise.all([child.exited, new Response(child.stderr).text()])
    if (exit !== 0) throw new Error(`Could not preserve Windows file security: ${error.trim()}`)
  } finally { clearTimeout(timer) }
}
