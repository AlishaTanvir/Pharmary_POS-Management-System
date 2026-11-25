$ErrorActionPreference='Stop'
& (Get-Command node.exe -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'stop.mjs')
if($LASTEXITCODE -ne 0){throw 'Shutdown request failed. Inspect the service before taking further action.'}
