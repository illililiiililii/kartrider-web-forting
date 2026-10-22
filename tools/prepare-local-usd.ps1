param(
  [string]$ConvertedRoot = (Join-Path $PSScriptRoot '..\local-assets'),
  [string]$RhoRoot = (Join-Path $PSScriptRoot '..\local-assets\rhoOut'),
  [string]$PythonExe = 'python',
  [string]$BlenderExe = 'blender'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'web-preview\assets\usd'
$items = @(
  @('kart','whiteKnightV1','whiteKnightV1_demo.usda',0.01),
  @('kart','saberV1','saberV1_demo.usda',0.01),
  @('character','dao','dao.usda',0.01),
  @('character','bazzi','bazzi_f00.usda',0.01),
  @('track','beach_I01','beach_I01.usda',0.01),
  @('track','beach_I02','beach_I02.usda',0.01),
  @('track','village_R01','village_R01.usda',0.01)
)
$runtimeChecked = $false
foreach ($item in $items) {
  $category = Join-Path $ConvertedRoot $item[0]
  $folders = @(if (Test-Path -LiteralPath $category) {
    Get-ChildItem -LiteralPath $category -Directory | Where-Object { $_.Name -eq $item[1] -or $_.Name.StartsWith($item[1] + '_') }
  })
  if ($folders.Count -gt 1) { throw "Ambiguous model directories: $($item[1])" }
  $folder = if ($folders.Count) { $folders[0].FullName } else { $category }
  $source = Join-Path $folder $item[2]
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    $candidates = @(if (Test-Path -LiteralPath $folder) {
      Get-ChildItem -LiteralPath $folder -File | Where-Object {
        $_.Extension.ToLowerInvariant() -in @('.usda','.usd','.usdc','.fbx') -and
        ($folders.Count -gt 0 -or $_.BaseName -eq $item[1] -or $_.BaseName -eq [IO.Path]::GetFileNameWithoutExtension($item[2]))
      }
    })
    if (-not $candidates.Count) { Write-Output "WAITING: $($item[0])/$($item[1]) model"; continue }
    if ($candidates.Count -ne 1) { throw "Ambiguous models: $($item[1]); use $($item[2])" }
    $source = $candidates[0].FullName
  }
  $format = & $PythonExe (Join-Path $PSScriptRoot 'model-format.py') $source
  if ($LASTEXITCODE -ne 0) { throw "Model signature check failed: $source" }
  if (-not $runtimeChecked) {
    & $PythonExe -c 'from pxr import Usd'
    if ($LASTEXITCODE -ne 0) { throw 'Install: python -m pip install usd-core==25.5.1' }
    $runtimeChecked = $true
  }
  if ($format -eq 'fbx') {
    $intermediate = Join-Path $root "local-data\fbx-usd\$($item[1])\model.usda"
    & $BlenderExe --background --python (Join-Path $PSScriptRoot 'convert-fbx-local.py') -- $source $intermediate
    if ($LASTEXITCODE -ne 0) { throw "FBX conversion failed: $source" }
    $source = $intermediate
  }
  $target = Join-Path (Join-Path $output $item[1]) 'model.mesh.json'
  $options = @('--scale',$item[3],'--rho-root',$RhoRoot)
  if ($item[0] -eq 'track') { $options += @('--ktrk',(Join-Path (Split-Path -Parent $target) 'collision.ktrk')) }
  & $PythonExe (Join-Path $PSScriptRoot 'convert-usd-local.py') $source $target @options
  if ($LASTEXITCODE -ne 0) { throw "Model conversion failed: $source" }
}
