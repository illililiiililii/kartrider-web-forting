param(
  [string]$DemoSource,
  [string]$ZigExe
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'resolve-demo-build.ps1')
$generated = Join-Path $root 'src-demo\generated_5136_course.c'
if (-not (Test-Path -LiteralPath $generated)) {
  throw 'Generate local 5136 course tables with tools/build-demo-physics.ps1 first'
}
if (Select-String -LiteralPath $generated -SimpleMatch 'NO_5136_ASSETS' -Quiet) { throw 'WAITING: original P5136 course assets are absent.' }
$output = Join-Path $root 'local-data\test-5136-course.exe'
New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
& $ZigExe cc -O2 -I (Join-Path $DemoSource 'include') `
  (Join-Path $DemoSource 'src\kart_course.c') `
  (Join-Path $DemoSource 'src\kart_track_collision.c') $generated `
  (Join-Path $DemoSource 'src\kart_demo_data.c') `
  (Join-Path $PSScriptRoot 'test-5136-course.c') -lm -o $output
if ($LASTEXITCODE -ne 0) { throw 'Course graph test compile failed' }
& $output
if ($LASTEXITCODE -ne 0) { throw 'Course graph test failed' }
