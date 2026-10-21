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
$menu = Join-Path $AssetRoot 'zeta\kr\stage\mainMenu'
foreach ($name in @('btn_speedIndi_1.png', 'btn_speedTeam_1.png')) {
  $sprite = Join-Path $menu $name
  if (Test-Path -LiteralPath $sprite -PathType Leaf) {
    Copy-Item -LiteralPath $sprite -Destination (Join-Path $target $name) -Force
  }
}

# Preserve the original stage namespaces: the same basename can have a
# different graphic in the base stage and Korean locale override.
foreach ($relative in @('stage\mainMenu', 'zeta\kr\stage\mainMenu', 'stage\speedIndiGame', 'stage\timeAttackReady', 'stage\logo', 'stage\common', 'dialog\garageDialog', 'dialog2\selectTrackEx', 'dialog2\userReport', 'gui\monocoque', 'gui\window\menu', 'gui\tachometer\v1', 'gui\tablet', 'myRoom\2022_Facelift_main')) {
  $folder = Join-Path $AssetRoot $relative
  if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
    throw "Original GUI folder missing: $folder"
  }
  $destination = Join-Path $target $relative
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  $images = Get-ChildItem -LiteralPath $folder -File -Filter '*.png'
  foreach ($image in $images) {
    Copy-Item -LiteralPath $image.FullName -Destination (Join-Path $destination $image.Name) -Force
  }
  Write-Host "Prepared $($images.Count) original GUI sprites from $relative"
}

$fontSource = Join-Path $AssetRoot 'gui\font'
$fontTarget = Join-Path $target 'gui\font'
New-Item -ItemType Directory -Force -Path $fontTarget | Out-Null
foreach ($name in @('NotoSansCJKkr-Medium.otf', 'NotoSansCJKkr-Bold.otf')) {
  $font = Join-Path $fontSource $name
  if (Test-Path -LiteralPath $font -PathType Leaf) {
    Copy-Item -LiteralPath $font -Destination (Join-Path $fontTarget $name) -Force
  }
}
$slotSource = Join-Path $AssetRoot 'item\slot\slot_v1.png'
$slotTarget = Join-Path $target 'item\slot'
New-Item -ItemType Directory -Force -Path $slotTarget | Out-Null
Copy-Item -LiteralPath $slotSource -Destination (Join-Path $slotTarget 'slot_v1.png') -Force
