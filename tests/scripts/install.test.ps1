$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\..\install.ps1"

$temp = Join-Path $env:TEMP ('opencode\oec-installer-test-' + [Guid]::NewGuid().ToString('N'))
$originalLocal = $env:LOCALAPPDATA
$originalPath = $env:Path
$originalArchitecture = $env:PROCESSOR_ARCHITECTURE
$originalArchitecture64 = $env:PROCESSOR_ARCHITEW6432
$originalTls = [Net.ServicePointManager]::SecurityProtocol
$script:userPath = 'C:\Existing Tools;C:\Other'
$script:failure = ''
$script:reportedVersion = '1.2.3'
$script:requests = @()
$script:writes = 0
$script:checks = 0

function Assert($Condition, [string]$Message) {
    $script:checks++
    if (!$Condition) { throw "Assertion failed: $Message" }
}
function Reject([scriptblock]$Action) {
    $failed = $false
    try { & $Action } catch { $failed = $true }
    Assert $failed 'installer must reject unsafe input or failed download'
}
function Get-OecUserPath { return $script:userPath }
function Set-OecUserPath([string]$Value) {
    if ($script:failure -eq 'path' -and $Value -ne 'C:\Existing Tools;C:\Other') { throw 'Mock PATH write failure' }
    $script:writes++
    $script:userPath = $Value
}
function Get-OecBinaryVersion([string]$File) { return $script:reportedVersion }
function Move-Item {
    param([string]$LiteralPath, [string]$Destination, [switch]$Force)
    if ($script:failure -eq 'replace' -and $LiteralPath.EndsWith('new.sha256')) { throw 'Mock replacement failure' }
    Microsoft.PowerShell.Management\Move-Item @PSBoundParameters
}
function Invoke-RestMethod([string]$Uri) {
    $script:requests += $Uri
    if ($script:failure -eq 'release') { return @{ tag_name = '../../bad' } }
    return @{ tag_name = 'v1.2.3' }
}
function Invoke-WebRequest([switch]$UseBasicParsing, [string]$Uri, [string]$OutFile) {
    $script:requests += $Uri
    if ($script:failure -eq 'network') { throw 'Mock network failure' }
    if ($Uri.EndsWith('/SHA256SUMS')) {
        $hash = (Get-FileHash -LiteralPath (Join-Path (Split-Path $OutFile) 'oec-win32-x64.exe') -Algorithm SHA256).Hash
        if ($script:failure -eq 'checksum') { $hash = '0' * 64 }
        $name = 'oec-win32-x64.exe'
        if ($script:failure -eq 'missing') { $name = 'other.exe' }
        $lines = @("$hash  $name")
        if ($script:failure -eq 'duplicate') { $lines += $lines[0] }
        Set-Content -LiteralPath $OutFile -Value $lines -Encoding Ascii
    } else {
        Set-Content -LiteralPath $OutFile -Value "mock executable $script:reportedVersion" -Encoding Ascii
    }
}

try {
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    $env:LOCALAPPDATA = Join-Path $temp 'profile with spaces'
    $env:PROCESSOR_ARCHITECTURE = 'AMD64'
    $env:PROCESSOR_ARCHITEW6432 = ''
    $bin = Join-Path $env:LOCALAPPDATA 'Programs\OpenEditorCode\bin'
    $exe = Join-Path $bin 'oec.exe'
    $marker = Join-Path $bin '.oec-install-ps1.sha256'

    Install-Oec
    Assert (Test-Path -LiteralPath $exe) 'downloads executable'
    Assert ($script:userPath -eq "$bin;C:\Existing Tools;C:\Other") 'persists user PATH without losing existing entries'
    Assert (Test-OecPathEntry $env:Path $bin) 'updates current process PATH'
    Assert ($script:requests -contains 'https://github.com/2jmalvarez/openeditorcode/releases/download/v1.2.3/oec-win32-x64.exe') 'resolves latest release'
    Assert ((Get-FileHash -LiteralPath $exe).Hash -eq (Get-Content -LiteralPath $marker -Raw).Trim()) 'records ownership checksum'
    $writes = $script:writes
    Install-Oec -Version v1.2.3
    Assert ($script:writes -eq $writes) 'repeated installation does not duplicate PATH'
    Assert (Test-OecPathEntry ('C:\other;"' + $bin.ToUpper() + '\"') $bin) 'recognizes quoted case-insensitive PATH entries with trailing slash'

    $script:reportedVersion = '2.0.0'
    Install-Oec -Version 2.0.0 -NoModifyPath
    $previous = Get-Content -LiteralPath $exe -Raw
    Assert ($previous.Contains('2.0.0')) 'updates owned installation'
    foreach ($failure in @('network', 'checksum', 'missing', 'duplicate', 'release')) {
        $script:failure = $failure
        Reject { Install-Oec }
        Assert ((Get-Content -LiteralPath $exe -Raw) -eq $previous) "preserves installation on $failure failure"
    }
    $script:failure = ''
    Reject { Install-Oec -Version 3.0.0 }
    Reject { Install-Oec -Version '../../bad' }
    Reject { Install-Oec -Version v }
    Assert ((Get-Content -LiteralPath $exe -Raw) -eq $previous) 'version mismatch preserves installation'

    $script:userPath = 'C:\Existing Tools;C:\Other'
    $beforePath = $env:Path
    $script:reportedVersion = '3.0.0'
    $script:failure = 'replace'
    Reject { Install-Oec -Version 3.0.0 }
    Assert ((Get-Content -LiteralPath $exe -Raw) -eq $previous) 'rolls back partially replaced executable'
    Assert ((Get-FileHash -LiteralPath $exe).Hash -eq (Get-Content -LiteralPath $marker -Raw).Trim()) 'rolls back ownership marker'
    $script:failure = 'path'
    Reject { Install-Oec -Version 3.0.0 }
    Assert ((Get-Content -LiteralPath $exe -Raw) -eq $previous) 'rolls back executable after PATH failure'
    Assert ($script:userPath -eq 'C:\Existing Tools;C:\Other') 'preserves user PATH after failure'
    Assert ($env:Path -eq $beforePath) 'preserves process PATH after failure'
    $script:failure = ''
    $script:reportedVersion = '2.0.0'
    Install-Oec -Version 2.0.0 -NoModifyPath
    Assert ($script:userPath -eq 'C:\Existing Tools;C:\Other') 'NoModifyPath leaves user PATH untouched'
    Assert ($env:Path -eq $beforePath) 'NoModifyPath leaves process PATH untouched'

    Set-Content -LiteralPath $exe -Value 'modified'
    Reject { Install-Oec -Version 2.0.0 }
    Assert ((Get-Content -LiteralPath $exe -Raw).Trim() -eq 'modified') 'does not overwrite modified executable'
    Remove-Item -LiteralPath $marker
    Reject { Install-Oec -Version 2.0.0 }
    Assert ((Get-Content -LiteralPath $exe -Raw).Trim() -eq 'modified') 'does not overwrite unrelated executable'

    $lock = Join-Path $bin '.oec-install-ps1.lock'
    Set-Content -LiteralPath $lock -Value 'foreign lock'
    Reject { Install-Oec -Version 2.0.0 }
    Assert (Test-Path -LiteralPath $lock) 'does not delete another installation lock'
    Remove-Item -LiteralPath $lock
    Assert (@(Get-ChildItem -LiteralPath $bin -Force -Filter '.oec-install.*').Count -eq 0) 'cleans temporary files'
    Assert ([Net.ServicePointManager]::SecurityProtocol -eq $originalTls) 'restores TLS settings'

    $env:LOCALAPPDATA = Join-Path $temp 'initial failure'
    $script:failure = 'path'
    Reject { Install-Oec -Version 2.0.0 }
    $initialBin = Join-Path $env:LOCALAPPDATA 'Programs\OpenEditorCode\bin'
    Assert (!(Test-Path -LiteralPath (Join-Path $initialBin 'oec.exe'))) 'failed initial installation leaves no executable'
    Assert (!(Test-Path -LiteralPath (Join-Path $initialBin '.oec-install-ps1.sha256'))) 'failed initial installation leaves no marker'
    Assert (@(Get-ChildItem -LiteralPath $initialBin -Force).Count -eq 0) 'failed initial installation cleans lock and staging files'
    $script:failure = ''
    $env:Path = $originalPath
    Install-Oec -Version 2.0.0 -NoModifyPath
    Assert ($env:Path -eq $originalPath) 'first NoModifyPath installation leaves session untouched'

    $env:LOCALAPPDATA = Join-Path $temp 'junction profile'
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA | Out-Null
    $target = Join-Path $temp 'junction target'
    New-Item -ItemType Directory -Path $target | Out-Null
    $junction = New-Item -ItemType Junction -Path (Join-Path $env:LOCALAPPDATA 'Programs') -Target $target
    try {
        Reject { Install-Oec -Version 2.0.0 }
        Assert (@(Get-ChildItem -LiteralPath $target -Force).Count -eq 0) 'rejects installation through junctions'
    } finally {
        # Directory.Delete removes only the junction, not its target (including on PowerShell 5.1).
        [IO.Directory]::Delete($junction.FullName)
    }

    $env:PROCESSOR_ARCHITECTURE = 'ARM64'
    Reject { Install-Oec -Version 2.0.0 }
    Write-Host "PowerShell installer: $script:checks offline checks passed."
} finally {
    $env:LOCALAPPDATA = $originalLocal
    $env:Path = $originalPath
    $env:PROCESSOR_ARCHITECTURE = $originalArchitecture
    $env:PROCESSOR_ARCHITEW6432 = $originalArchitecture64
    Remove-Item -LiteralPath $temp -Recurse -Force
}
