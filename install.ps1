# Download and run from PowerShell; no Node.js, npm, Bun or administrator required.
[CmdletBinding()]
param(
    [string]$Version = '',
    [switch]$NoModifyPath
)

function Get-OecUserPath { [Environment]::GetEnvironmentVariable('Path', 'User') }
function Set-OecUserPath([string]$Value) { [Environment]::SetEnvironmentVariable('Path', $Value, 'User') }
function Get-OecBinaryVersion([string]$File) {
    $reported = & $File --version
    if ($LASTEXITCODE -ne 0) { throw 'The downloaded binary cannot run on this system.' }
    return "$reported".Trim()
}

function Test-OecPathEntry([string]$PathValue, [string]$Directory) {
    foreach ($entry in ($PathValue -split ';')) {
        if ([Environment]::ExpandEnvironmentVariables($entry.Trim().Trim('"')).TrimEnd('\', '/') -ieq $Directory.TrimEnd('\', '/')) {
            return $true
        }
    }
    return $false
}

function Install-Oec {
    [CmdletBinding()]
    param([string]$Version = '', [switch]$NoModifyPath)

    $ErrorActionPreference = 'Stop'
    $architecture = $env:PROCESSOR_ARCHITEW6432
    if (!$architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
    if ($env:OS -ne 'Windows_NT' -or $architecture -ne 'AMD64') {
        throw 'Only Windows x64 is supported. On Linux/WSL use install.sh.'
    }
    if (!$env:LOCALAPPDATA -or ![IO.Path]::IsPathRooted($env:LOCALAPPDATA)) {
        throw 'LOCALAPPDATA must be an absolute directory.'
    }
    $hasVersion = ![string]::IsNullOrEmpty($Version)
    $Version = $Version -creplace '^v', ''
    $versionPattern = '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$'
    if ($hasVersion -and $Version -cnotmatch $versionPattern) { throw 'Invalid version.' }

    $bin = Join-Path $env:LOCALAPPDATA 'Programs\OpenEditorCode\bin'
    # Do not install through directory junctions or symbolic links.
    $ancestor = $bin
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            $item = Get-Item -LiteralPath $ancestor -Force
            if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "Unsafe installation directory: $ancestor"
            }
        }
        $ancestor = Split-Path -Path $ancestor -Parent
    }
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
    $exe = Join-Path $bin 'oec.exe'
    $marker = Join-Path $bin '.oec-install-ps1.sha256'
    $lockPath = Join-Path $bin '.oec-install-ps1.lock'
    $lock = $null
    $temp = $null
    $replacing = $false
    $hadInstall = $false
    $pathChanged = $false
    $preserveTemp = $false
    $oldUserPath = Get-OecUserPath
    $oldTls = [Net.ServicePointManager]::SecurityProtocol
    try {
        $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $temp = Join-Path $bin ('.oec-install.' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $temp | Out-Null
        if ((Test-Path -LiteralPath $exe) -or (Test-Path -LiteralPath $marker)) {
            foreach ($file in @($exe, $marker)) {
                $item = Get-Item -LiteralPath $file -Force
                if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                    throw 'Refusing to replace unrelated files or links.'
                }
            }
            if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ine (Get-Content -LiteralPath $marker -Raw).Trim()) {
                throw 'Existing installation is modified or not owned by this installer.'
            }
            $hadInstall = $true
        }

        [Net.ServicePointManager]::SecurityProtocol = $oldTls -bor [Net.SecurityProtocolType]::Tls12
        $base = 'https://github.com/2jmalvarez/openeditorcode/releases'
        if (!$Version) {
            $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/2jmalvarez/openeditorcode/releases/latest'
            $Version = "$($release.tag_name)" -creplace '^v', ''
            if ($Version -cnotmatch $versionPattern) { throw 'Invalid release version.' }
        }
        Write-Host "Downloading OpenEditorCode $Version..."
        $asset = 'oec-win32-x64.exe'
        $download = Join-Path $temp $asset
        $checksums = Join-Path $temp 'SHA256SUMS'
        Invoke-WebRequest -UseBasicParsing -Uri "$base/download/v$Version/$asset" -OutFile $download
        Invoke-WebRequest -UseBasicParsing -Uri "$base/download/v$Version/SHA256SUMS" -OutFile $checksums
        $matches = @(Get-Content -LiteralPath $checksums | Where-Object { $_ -cmatch '^[0-9a-fA-F]{64}\s+\*?oec-win32-x64\.exe$' })
        if ($matches.Count -ne 1) { throw 'Missing, duplicate or invalid checksum.' }
        $expected = ($matches[0] -split '\s+')[0]
        if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ine $expected) {
            throw 'Checksum mismatch; nothing installed.'
        }
        if ((Get-OecBinaryVersion $download) -cne $Version) { throw 'Binary version mismatch.' }
        $newMarker = Join-Path $temp 'new.sha256'
        Set-Content -LiteralPath $newMarker -Value $expected -Encoding Ascii
        if ($hadInstall) {
            Copy-Item -LiteralPath $exe -Destination (Join-Path $temp 'previous.exe')
            Copy-Item -LiteralPath $marker -Destination (Join-Path $temp 'previous.sha256')
        }
        $replacing = $true
        Move-Item -LiteralPath $download -Destination $exe -Force
        Move-Item -LiteralPath $newMarker -Destination $marker -Force
        if (!$NoModifyPath) {
            if (!(Test-OecPathEntry $oldUserPath $bin)) {
                $newPath = $bin
                if ($oldUserPath) { $newPath += ';' + $oldUserPath }
                $pathChanged = $true
                Set-OecUserPath $newPath
            }
            if (!(Test-OecPathEntry $env:Path $bin)) { $env:Path = "$bin;$env:Path" }
        }
        $replacing = $false
        Write-Host "OpenEditorCode $Version installed in $bin"
        if ($NoModifyPath) {
            Write-Host "PATH unchanged. Run: & `"$exe`" ."
        } else {
            Write-Host 'Run: oec . (PATH updated for this session and future terminals.)'
        }
    } catch {
        $failureRecord = $_
        if ($replacing) {
            try {
                if ($hadInstall) {
                    Copy-Item -LiteralPath (Join-Path $temp 'previous.exe') -Destination $exe -Force
                    Copy-Item -LiteralPath (Join-Path $temp 'previous.sha256') -Destination $marker -Force
                } else {
                    foreach ($file in @($exe, $marker)) {
                        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
                    }
                }
            } catch {
                $preserveTemp = $true
                Write-Warning "Could not restore installation. Recovery files preserved in: $temp"
            }
        }
        if ($pathChanged) { Set-OecUserPath $oldUserPath }
        throw $failureRecord
    } finally {
        [Net.ServicePointManager]::SecurityProtocol = $oldTls
        try {
            if ($temp -and !$preserveTemp -and (Test-Path -LiteralPath $temp)) {
                Remove-Item -LiteralPath $temp -Recurse -Force
            }
        } finally {
            if ($lock) {
                $lock.Dispose()
                Remove-Item -LiteralPath $lockPath -Force
            }
        }
    }
}

# Dot sourcing exposes the functions for offline tests without installing anything.
if ($MyInvocation.InvocationName -ne '.') {
    Install-Oec -Version $Version -NoModifyPath:$NoModifyPath
}
