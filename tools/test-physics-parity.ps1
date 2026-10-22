param([string]$DemoSource,[string]$ZigExe)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'resolve-demo-build.ps1')
$output=Join-Path $root 'local-data\physics-reference.exe'
$modules=@(Get-ChildItem -LiteralPath (Join-Path $DemoSource 'src') -Filter '*.c' | ForEach-Object FullName)
& $ZigExe cc -O2 -I (Join-Path $DemoSource 'include') -I (Join-Path $DemoSource 'demo') $modules (Join-Path $PSScriptRoot 'physics-reference.c') -lm -o $output
if ($LASTEXITCODE -ne 0) { throw 'Native reference build failed' }
$track=Join-Path $root 'web-preview\assets\usd\beach_I01\collision.ktrk'
$arguments=@(); if (Test-Path -LiteralPath $track) { $arguments=@($track) }
& $output @arguments | Set-Content -LiteralPath (Join-Path $root 'local-data\native-physics.csv') -Encoding ascii
if ($LASTEXITCODE -ne 0) { throw 'Native reference execution failed' }
& node --test (Join-Path $PSScriptRoot 'test-physics-parity.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Native/Wasm parity failed' }
