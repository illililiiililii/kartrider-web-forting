param(
  [string]$AssetRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK\KartRider_5136_01_UNPACK\_rhoOut'
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $AssetRoot 'gui\tachometer\default\tachometer.png'
$target = Join-Path $PSScriptRoot '..\web-preview\assets\ui'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "Original tachometer sprite missing: $source"
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $target 'tachometer.png') -Force
Write-Host "Prepared original P5136 tachometer sprite: $source"
