param(
  [string]$DemoSource,
  [string]$ZigExe,
  [string]$RhoRoot,
  [string]$PythonExe = 'python',
  [switch]$Bootstrap
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$RhoRoot = Resolve-LocalRhoRoot $RhoRoot
. (Join-Path $PSScriptRoot 'resolve-demo-build.ps1')
$generatedCourse = Join-Path $root 'src-demo\generated_5136_course.c'
$tracks = @('beach_I01', 'beach_I02', 'village_R01')
$available = @($tracks | Where-Object { Test-Path -LiteralPath (Resolve-LocalTrackFile $RhoRoot $_) })
if ($available.Count -eq 3) {
  $catalogArgs=@()
  $catalog=Join-Path $root 'web-preview\assets\catalog.json'
  if (Test-Path -LiteralPath $catalog) { $catalogArgs=@('--catalog',$catalog) }
  & $PythonExe (Join-Path $PSScriptRoot 'prepare-local-course.py') --demo-source $DemoSource --rho-root $RhoRoot --output $generatedCourse @catalogArgs
  if ($LASTEXITCODE -ne 0) { throw 'P5136 course extraction failed' }
  $courseMode = 'original-5136'
} elseif ($available.Count -eq 0) {
  # Always overwrite any stale generated tables when original resources are absent.
  @'
/* NO_5136_ASSETS: debug physics only, no substitution with 2004 gates. */
#include "kart_course.h"
#include <stddef.h>
const KartCourseAsset *kart_5136_course_asset_at(unsigned int index) { (void)index; return NULL; }
unsigned int kart_5136_course_laps(unsigned int index) { (void)index; return 0; }
'@ | Set-Content -LiteralPath $generatedCourse -Encoding ascii
  $courseMode = 'debug-only-no-5136-assets'
  Write-Output 'WAITING: P5136 courses unavailable; building standalone debug physics.'
} else { throw 'Partial P5136 input: provide all three original track.1s files or none.' }
. (Join-Path $PSScriptRoot 'prepare-demo-overlays.ps1')
$modules = @(Get-WebDemoModules $DemoSource $root)
if ($modules.Count -ne 13) { throw "Expected 13 pinned C modules; found $($modules.Count)" }
$output = Join-Path $root 'web-preview\demo_physics.wasm'
& $ZigExe cc -target wasm32-wasi -O2 '-Wl,--no-entry' '-Wl,--export-memory' '-Wl,-z,stack-size=1048576' `
  -I (Join-Path $DemoSource 'include') -I (Join-Path $DemoSource 'demo') $modules $generatedCourse `
  (Join-Path $root 'src-demo\demo_bridge.c') -lm -o $output
if ($LASTEXITCODE -ne 0) { throw 'Demo physics Wasm build failed' }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'local-data') | Out-Null
@{ revision=$sourceInfo.revision; zig='0.13.0'; courses=$courseMode; wasmSha256=(Get-FileHash -LiteralPath $output).Hash } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'local-data\physics-build.json') -Encoding utf8
Write-Output "Built $output ($courseMode)"
