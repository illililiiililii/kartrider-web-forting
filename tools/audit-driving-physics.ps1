param([string]$DemoSource,[string]$ZigExe)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'resolve-demo-build.ps1')
$taskOutput=Join-Path $root 'local-data/physics-profile-reference.exe'
$taskModules=@(Get-ChildItem -LiteralPath (Join-Path $DemoSource 'src') -Filter '*.c' | ForEach-Object FullName)
& $ZigExe cc -O2 -I (Join-Path $DemoSource 'include') $taskModules (Join-Path $PSScriptRoot 'physics-profile-reference.c') -lm -o $taskOutput
if($LASTEXITCODE -ne 0){throw 'Profile native audit build failed'}
& node (Join-Path $PSScriptRoot 'audit-driving-physics.mjs')
if($LASTEXITCODE -ne 0){throw 'Driving audit failed; see local-data/driving-physics-audit.json'}
