param(
  [string]$ConvertedRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_02_CONVERT',
  [string]$RhoRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK\KartRider_5136_01_UNPACK\_rhoOut'
)

$ErrorActionPreference = 'Stop'
$localUsd = Join-Path $PSScriptRoot '..\..\..\work\usd-python'
if (Test-Path -LiteralPath (Join-Path $localUsd 'pxr') -PathType Container) {
  $env:PYTHONPATH = "$localUsd$([IO.Path]::PathSeparator)$env:PYTHONPATH"
}
python -c 'from pxr import Usd' 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'Python usd-core is required. Install locally: python -m pip install usd-core==25.5.1'
}

$output = Join-Path $PSScriptRoot '..\web-preview\assets\usd'
$items = @(
  @('kart', 'whiteKnightV1', 'whiteKnightV1_demo.usda', 0.01),
  @('kart', 'saberV1', 'saberV1_demo.usda', 0.01),
  @('character', 'dao', 'dao.usda', 0.01),
  @('character', 'bazzi', 'bazzi_f00.usda', 0.01),
  @('track', 'beach_I01', 'beach_I01.usda', 0.001),
  @('track', 'beach_I02', 'beach_I02.usda', 0.001),
  @('track', 'village_R01', 'village_R01.usda', 0.001)
)
foreach ($item in $items) {
  $categoryRoot = Join-Path $ConvertedRoot $item[0]
  $assetFolder = Get-ChildItem -LiteralPath $categoryRoot -Directory | Where-Object {
    $_.Name -eq $item[1] -or $_.Name.StartsWith($item[1] + '_')
  } | Select-Object -First 1
  if (-not $assetFolder) { throw "Missing supplied USD directory: $($item[0])/$($item[1])" }
  $source = Join-Path $assetFolder.FullName $item[2]
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Missing supplied USD asset: $source"
  }
  $target = Join-Path (Join-Path $output $item[1]) 'model.mesh.json'
  if ($item[0] -eq 'track') {
    $collisionFile = Join-Path (Split-Path -Parent $target) 'collision.ktrk'
    python (Join-Path $PSScriptRoot 'convert-usd-local.py') $source $target --scale $item[3] --ktrk $collisionFile --rho-root $RhoRoot
  } else {
    python (Join-Path $PSScriptRoot 'convert-usd-local.py') $source $target --scale $item[3] --rho-root $RhoRoot
  }
  if ($LASTEXITCODE -ne 0) { throw "USD conversion failed: $source" }
}
