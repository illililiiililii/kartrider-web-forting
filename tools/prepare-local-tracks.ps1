param(
  [string]$AssetRoot,
  [string]$PythonExe = 'python'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$AssetRoot = Resolve-LocalRhoRoot $AssetRoot
if (-not (Test-Path -LiteralPath (Resolve-LocalTrackFile $AssetRoot 'beach_I01' 'xt_minimap.png'))) {
  Write-Output 'WAITING: put original P5136 resources in local-assets/rhoOut.'
  return
}
$outputRoot = Join-Path $PSScriptRoot '..\web-preview\assets\tracks'
foreach ($track in @('beach_I01', 'beach_I02', 'village_R01')) {
  $target = Join-Path $outputRoot $track
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($image in @('xt_bigmap.png', 'xt_minimap.png', 'xt_trackCard.png', 'xt_trackThumb.png')) {
    $inputFile = Resolve-LocalTrackFile $AssetRoot $track $image
    if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
      throw "Missing original track image: $inputFile"
    }
    Copy-Item -LiteralPath $inputFile -Destination (Join-Path $target $image) -Force
  }
  Write-Host "Prepared local original artwork: $track"
}
& $PythonExe (Join-Path $PSScriptRoot 'prepare-local-track-art.py') --rho-root $AssetRoot
if ($LASTEXITCODE -ne 0) { throw 'Original minimap registration failed' }
