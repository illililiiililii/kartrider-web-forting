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
}
foreach ($name in $files.Keys) {
  $source = Join-Path $AssetRoot $files[$name]
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Original audio missing: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $output $name) -Force
  Write-Host "Prepared local audio: $name"
}
