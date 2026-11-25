param([Parameter(Mandatory=$true)][string]$InstallDirectory,[Parameter(Mandatory=$true)][string]$DataDirectory,[Parameter(Mandatory=$true)][string]$PostgresBinDirectory,[string]$BackupBinDirectory=$PostgresBinDirectory,[int]$Port=3002,[int]$PostgresPort=55433,[string]$PharmacyName='Configure your pharmacy')
$ErrorActionPreference='Stop'
$packageRoot=$PSScriptRoot
$target=[IO.Path]::GetFullPath($InstallDirectory)
$privateData=[IO.Path]::GetFullPath($DataDirectory)
if($target -eq $privateData -or $target.StartsWith($privateData.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or $privateData.StartsWith($target.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Program and data directories must be separate.'}
if(Test-Path -LiteralPath $target){throw 'Choose a new program directory for installation or upgrade. Existing program files were preserved.'}
if($Port -lt 1024 -or $Port -gt 65535 -or $PostgresPort -lt 1024 -or $PostgresPort -gt 65535 -or $Port -eq $PostgresPort){throw 'Choose distinct application and database ports from 1024 to 65535.'}
$node=(Get-Command node.exe -ErrorAction Stop).Source
if([int](& $node -p "process.versions.node.split('.')[0]") -lt 24){throw 'Node.js 24 or later is required.'}
& $node (Join-Path $packageRoot 'verify-release.mjs') $packageRoot
if($LASTEXITCODE -ne 0){throw 'Release qualification failed. Program and private data were not changed.'}
$pg=[IO.Path]::GetFullPath($PostgresBinDirectory)
foreach($name in @('pg_ctl.exe','initdb.exe','postgres.exe')){if(!(Test-Path -LiteralPath (Join-Path $pg $name))){throw "Missing PostgreSQL utility: $name"}}
$pgVersion=& (Join-Path $pg 'postgres.exe') --version
if($pgVersion -notmatch ' 18\.'){throw 'This release requires PostgreSQL 18.'}
foreach($name in @('pg_dump.exe','pg_restore.exe')){if(!(Test-Path -LiteralPath (Join-Path $BackupBinDirectory $name))){throw "Missing backup utility: $name"}}
$manifest=Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.files){$source=[IO.Path]::GetFullPath((Join-Path $packageRoot $entry.path));if(!$source.StartsWith($packageRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe manifest path.'};if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.sha256){throw "Package integrity check failed: $($entry.path)"}}
New-Item -ItemType Directory -Path $target | Out-Null
foreach($entry in $manifest.files){$destination=Join-Path $target $entry.path;New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null;Copy-Item -LiteralPath (Join-Path $packageRoot $entry.path) -Destination $destination}
Copy-Item -LiteralPath (Join-Path $packageRoot 'manifest.json') -Destination $target
New-Item -ItemType Directory -Path $privateData -Force | Out-Null
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $privateData /inheritance:r /grant:r "*$($sid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not protect the private data directory.'}
$envFile=Join-Path $privateData '.env'
if(!(Test-Path -LiteralPath $envFile)){
 $random=[Security.Cryptography.RandomNumberGenerator]::Create()
 function New-Secret([int]$length){$bytes=New-Object byte[] $length;$random.GetBytes($bytes);return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()}
 $databasePassword=New-Secret 24;$ownerPassword=New-Secret 24;$backupKey=New-Secret 32;$control=New-Secret 32
 $safeName=$PharmacyName.Replace('"','').Replace("`r",'').Replace("`n",'')
 $envLines=@("DATABASE_URL=postgres://postgres:$databasePassword@127.0.0.1:$PostgresPort/pharmacy_pos","LOCAL_DB_PASSWORD=$databasePassword","LOCAL_POSTGRES_PORT=$PostgresPort","PORT=$Port","PHARMACY_NAME=`"$safeName`"",'BOOTSTRAP_OWNER_USERNAME=owner',"BOOTSTRAP_OWNER_PASSWORD=$ownerPassword","BACKUP_KEY=$backupKey","LOCAL_CONTROL_TOKEN=$control",'SESSION_MINUTES=30','COOKIE_SECURE=false','BACKUP_OFF_DEVICE=false',"BACKUP_DIRECTORY=`"$($privateData.Replace('\','/'))/backups`"","OFFLINE_DB_PATH=`"$($privateData.Replace('\','/'))/counter.sqlite`"","POSTGRES_BIN_DIRECTORY=`"$($pg.Replace('\','/'))`"","PG_DUMP_PATH=`"$((Join-Path $BackupBinDirectory 'pg_dump.exe').Replace('\','/'))`"","PG_RESTORE_PATH=`"$((Join-Path $BackupBinDirectory 'pg_restore.exe').Replace('\','/'))`"")
 [IO.File]::WriteAllLines($envFile,$envLines,(New-Object Text.UTF8Encoding($false)))
 [IO.File]::WriteAllLines((Join-Path $privateData 'initial-owner-credentials.txt'),@('Username: owner',"Password: $ownerPassword",'Change the password after first sign-in. Secure and remove this file after recording credentials in approved custody.'),(New-Object Text.UTF8Encoding($false)))
 $random.Dispose()
}
[IO.File]::WriteAllText((Join-Path $target 'data-location.txt'),$privateData,(New-Object Text.UTF8Encoding($false)))
Write-Output 'Installed with separate protected data. Use Start.ps1; initial credentials are in the private data directory. No browser or process was started automatically.'
