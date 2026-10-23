param([string]$RhoRoot,[string]$PythonExe='python',[int]$Workers=3)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$RhoRoot=Resolve-LocalRhoRoot $RhoRoot
$root=Split-Path -Parent $PSScriptRoot
$usd=Join-Path $root '.tools\usd-python'
if (Test-Path -LiteralPath (Join-Path $usd 'pxr')) { $env:PYTHONPATH="$usd$([IO.Path]::PathSeparator)$env:PYTHONPATH" }
& (Join-Path $PSScriptRoot 'prepare-local-collision.ps1') -RhoRoot $RhoRoot -PythonExe $PythonExe -BuildOnly
$conversionLog=Join-Path $root 'local-data\catalog-conversion.log'
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-all.py') --rho-root $RhoRoot --workers $Workers *> $conversionLog
if ($LASTEXITCODE -ne 0) { throw 'Asset catalog preparation failed; see local-data/catalog-logs' }
Write-Output "Local model catalog prepared; conversion details: $conversionLog"
& (Join-Path $PSScriptRoot 'build-demo-physics.ps1') -RhoRoot $RhoRoot -PythonExe $PythonExe
& node (Join-Path $PSScriptRoot 'validate-local-catalog.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Catalog Wasm validation failed' }
