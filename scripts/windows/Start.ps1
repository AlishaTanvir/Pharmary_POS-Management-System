$ErrorActionPreference='Stop'
$privateData=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'data-location.txt') -Raw).Trim()
$node=(Get-Command node.exe -ErrorAction Stop).Source
& $node (Join-Path $PSScriptRoot 'verify-release.mjs') $PSScriptRoot --installed
if($LASTEXITCODE -ne 0){throw 'Installed release integrity failed. The service was not started.'}
Start-Process -FilePath $node -ArgumentList @(('"'+(Join-Path $PSScriptRoot 'supervisor.mjs')+'"'),('"'+$privateData+'"')) -WorkingDirectory $privateData -WindowStyle Hidden
Write-Output 'Starting the local service. Check health and the private application log before signing in.'
