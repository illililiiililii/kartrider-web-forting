# Optional machine-local mapping; raw resources and this configuration stay ignored.
function Resolve-LocalRhoRoot([string]$Override) {
  if ($Override) { return $Override }
  if ($env:KART_ASSET_ROOT) { return $env:KART_ASSET_ROOT }
  $project = Split-Path -Parent $PSScriptRoot
  $local=Join-Path $project 'local-assets\rhoOut'
  if ((Test-Path -LiteralPath (Join-Path $local 'gui') -PathType Container) -and
      (Test-Path -LiteralPath (Join-Path $local 'stage') -PathType Container)) { return $local }
  $config = Join-Path $project 'local-data\asset-paths.json'
  if (Test-Path -LiteralPath $config) {
    $settings = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
    if ($settings.rhoRoot) { return [string]$settings.rhoRoot }
  }
  return $local
}

function Resolve-LocalTrackFile([string]$RhoRoot, [string]$Track, [string]$Name = 'track.1s') {
  $project = Split-Path -Parent $PSScriptRoot
  foreach ($directory in @((Join-Path $project "local-assets\track\$Track"), (Join-Path $project "local-assets\rhoOut\track\$Track"), (Join-Path $RhoRoot "track\$Track"))) {
    $names = @($Name)
    if ($Name -eq 'track.1s') { $names += 'track.s1' }
    foreach ($filename in $names) {
      $candidate = Join-Path $directory $filename
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  return (Join-Path $project "local-assets\track\$Track\$Name")
}
