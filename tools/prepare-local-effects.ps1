param([string]$AssetRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$AssetRoot=Resolve-LocalRhoRoot $AssetRoot
$project=Split-Path -Parent $PSScriptRoot
$files=@('effect/booster/10main/10Fire01.png','effect/boosterFlare/cotton6/6buster001.png','effect/boosterFlare/cotton6/6buster002.png','effect/boosterWave/8Flashbooster_05.png','effect/boosterWave/9wave01.png','effect/boosterBlur/blurMask.png','effect/boosterBlur/blurMask2.png','stage/timeAttackReady/boostTex_0.png','stage/timeAttackReady/boostTex_1.png')
foreach ($relative in $files) {
  $source=Join-Path $project "local-assets/rhoOut/$relative"
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { $source=Join-Path $AssetRoot $relative }
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Original effect missing: $relative" }
  $target=Join-Path $project "web-preview/assets/effects/$relative"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}
Write-Output "Prepared $($files.Count) original boost images (local only)."
