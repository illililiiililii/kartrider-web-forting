param([string]$RhoRoot,[string]$PythonExe='python',[int]$Workers=3,
  [string]$PhysicsClient,
  [string]$PhysicsReference)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
. (Join-Path $PSScriptRoot 'local-python.ps1')
$RhoRoot=Resolve-LocalRhoRoot $RhoRoot
$root=Split-Path -Parent $PSScriptRoot
$bundledDotnet=Join-Path $root '.tools/dotnet'
if (Test-Path -LiteralPath (Join-Path $bundledDotnet 'dotnet.exe')) {
  $env:DOTNET_ROOT=$bundledDotnet
  $env:PATH="$bundledDotnet$([IO.Path]::PathSeparator)$env:PATH"
}
if (-not $PhysicsClient) {
  foreach ($candidate in @((Join-Path $root 'local-assets/client'),(Join-Path $root 'local-assets/rhoOut'))) {
    if (Test-Path -LiteralPath (Join-Path $candidate 'E/_rho5Out/kart_')) { $PhysicsClient=$candidate; break }
  }
}
if (-not $PhysicsReference) { $PhysicsReference=Join-Path $root '.tools/P5136_Rust' }
$usd=Join-Path $root '.tools\usd-python'
Enable-LocalPython $PythonExe -Usd
& (Join-Path $PSScriptRoot 'prepare-local-collision.ps1') -RhoRoot $RhoRoot -PythonExe $PythonExe -BuildOnly
$conversionLog=Join-Path $root 'local-data\catalog-conversion.log'
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-all.py') --rho-root $RhoRoot --workers $Workers *> $conversionLog
if ($LASTEXITCODE -ne 0) { throw 'Asset catalog preparation failed; see local-data/catalog-logs' }
Write-Output "Local model catalog prepared; conversion details: $conversionLog"
$normalsLog=Join-Path $root 'local-data/normals.log'
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-normals.py') --rho-root $RhoRoot *> $normalsLog
if ($LASTEXITCODE -ne 0) { throw 'Original normal preparation failed' }
Write-Output "Original normal preparation complete; details: $normalsLog"
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-sky.py') --rho-root $RhoRoot
if ($LASTEXITCODE -ne 0) { throw 'Original sky preparation failed' }
$ridersLog=Join-Path $root 'local-data/riders.log'
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-riders.py') *> $ridersLog
if ($LASTEXITCODE -ne 0) { throw 'Weighted driving pose preparation failed' }
$mountsLog=Join-Path $root 'local-data/mounts.log'
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-mounts.py') *> $mountsLog
if ($LASTEXITCODE -ne 0) { throw 'Original kart mount preparation failed' }
& (Join-Path $PSScriptRoot 'prepare-local-ui.ps1') -AssetRoot $RhoRoot -PythonExe $PythonExe
if($PhysicsClient -and (Test-Path -LiteralPath (Join-Path $PhysicsClient 'E/_rho5Out/kart_'))) {
  & $PythonExe (Join-Path $PSScriptRoot 'prepare-local-kart-physics.py') --client $PhysicsClient --rust $PhysicsReference
  if($LASTEXITCODE -ne 0){throw 'Korean per-kart physics preparation failed'}
} else {Write-Output 'WAITING: place original client E/_rho5Out/kart_ under local-assets/client for per-kart performance.'}
& (Join-Path $PSScriptRoot 'build-demo-physics.ps1') -RhoRoot $RhoRoot -PythonExe $PythonExe
& (Join-Path $PSScriptRoot 'prepare-local-audio.ps1') -AssetRoot $RhoRoot
& (Join-Path $PSScriptRoot 'prepare-local-lobby-gui.ps1') -AssetRoot $RhoRoot
& node (Join-Path $PSScriptRoot 'validate-local-catalog.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Catalog Wasm validation failed' }
