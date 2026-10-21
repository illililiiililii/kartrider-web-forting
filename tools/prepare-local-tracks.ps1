param(
  [string]$AssetRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK\KartRider_5136_01_UNPACK\_rhoOut'
)

$ErrorActionPreference = 'Stop'
$trackRoot = Join-Path $AssetRoot 'track'
$outputRoot = Join-Path $PSScriptRoot '..\web-preview\assets\tracks'
foreach ($track in @('beach_I01', 'beach_I02', 'village_R01')) {
  $source = Join-Path $trackRoot $track
  $target = Join-Path $outputRoot $track
  if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "Missing original track folder: $source"
  }
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($image in @('xt_minimap.png', 'xt_trackCard.png', 'xt_trackThumb.png')) {
    $inputFile = Join-Path $source $image
    if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
      throw "Missing original track image: $inputFile"
    }
    Copy-Item -LiteralPath $inputFile -Destination (Join-Path $target $image) -Force
  }
  Write-Host "Prepared local original artwork: $track"
}
