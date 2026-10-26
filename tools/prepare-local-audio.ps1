param(
  [string]$AssetRoot
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$AssetRoot = Resolve-LocalRhoRoot $AssetRoot
if (-not (Get-ChildItem -LiteralPath $AssetRoot -Force | Where-Object Name -ne '.gitkeep' | Select-Object -First 1)) {
  Write-Output 'WAITING: put original P5136 resources in local-assets/rhoOut.'
  return
}
$output = Join-Path $PSScriptRoot '..\web-preview\assets\audio'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$files = @{
  'beach.ogg' = 'sound\bgm\beach\beach_02.ogg'
  'village.ogg' = 'sound\bgm\village\village_01.ogg'
  'drift.ogg' = 'sound\fx\kart\drift.ogg'
  'boost.ogg' = 'sound\fx\kart\engine_X\booster.ogg'
  'exceed.ogg' = 'sound\fx\kart\engine_V1\exceed.ogg'
  'count_n.flac' = 'sound\fx\etc\count_n.flac'
  'count_go.flac' = 'sound\fx\etc\count_go.flac'
  'final_lab.flac' = 'sound\fx\etc\final_lab.flac'
  'race_over.flac' = 'sound\fx\etc\race_over.flac'
  'click.flac' = 'sound\fx\interface\click.flac'
  'startButton.flac' = 'sound\fx\interface\startButton.flac'
  'popup.flac' = 'sound\fx\interface\popup.flac'
  'transforming.ogg' = 'sound\fx\kart\transforming.ogg'
  'dualBooster.ogg' = 'sound\fx\kart\engine_common\dualBooster.ogg'
  'crash.ogg' = 'sound\fx\kart\crash.ogg'
  'collide.ogg' = 'sound\fx\kart\collide.ogg'
}
foreach ($name in $files.Keys) {
  $source = Join-Path $AssetRoot $files[$name]
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Original audio missing: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $output $name) -Force
  Write-Host "Prepared local audio: $name"
}
