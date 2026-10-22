# Optional machine-local mapping; raw resources and this configuration stay ignored.
function Resolve-LocalRhoRoot([string]$Override) {
  if ($Override) { return $Override }
  if ($env:KART_ASSET_ROOT) { return $env:KART_ASSET_ROOT }
  $project = Split-Path -Parent $PSScriptRoot
  $config = Join-Path $project 'local-data\asset-paths.json'
  if (Test-Path -LiteralPath $config) {
    $settings = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
    if ($settings.rhoRoot) { return [string]$settings.rhoRoot }
  }
  return (Join-Path $project 'local-assets\rhoOut')
}
