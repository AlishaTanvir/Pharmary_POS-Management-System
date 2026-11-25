$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsRoot = Join-Path $projectRoot '.tools'
$utilityRoot = Join-Path $toolsRoot 'pgsql\bin'
$archivePath = Join-Path $toolsRoot 'postgresql-windows.zip'
$downloadUrl = 'https://get.enterprisedb.com/postgresql/postgresql-18.7-1-windows-x64-binaries.zip'
New-Item -ItemType Directory -Force -Path $utilityRoot | Out-Null
if (-not (Test-Path -LiteralPath $archivePath)) {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
}
$expectedHash = 'EAD0BBC27FB678FA24DCF86B738981323042ABD073C744103BF7F3AED23F9A33'
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'PostgreSQL utility archive checksum mismatch. No files were extracted.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -match '^pgsql/bin/([^/]+\.dll|pg_dump\.exe|pg_restore\.exe)$') {
            $target = [IO.Path]::GetFullPath((Join-Path $utilityRoot $entry.Name))
            if ([IO.Path]::GetDirectoryName($target) -ne [IO.Path]::GetFullPath($utilityRoot)) { throw 'Invalid archive entry' }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    }
} finally { $archive.Dispose() }
@{ source = $downloadUrl; sha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $toolsRoot 'source.json')
& (Join-Path $utilityRoot 'pg_dump.exe') --version
& (Join-Path $utilityRoot 'pg_restore.exe') --version
