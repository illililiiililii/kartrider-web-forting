param(
    [string]$DemoSource,
    [string]$ZigExe
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$workspaceWork = Join-Path (Resolve-Path (Join-Path $root '..\..')) 'work'
if (-not $DemoSource) { $DemoSource = Join-Path $workspaceWork 'reference-demo-physics' }
if (-not $ZigExe) { $ZigExe = Join-Path $workspaceWork 'zig-windows-x86_64-0.13.0\zig.exe' }
$required = @('include\kart_simulation.h', 'include\kart_dynamics.h', 'include\kart_camera.h',
    'src\kart_dynamics.c', 'src\kart_simulation.c', 'src\kart_camera.c',
    'include\kart_demo_data.h', 'src\kart_demo_data.c')
foreach ($part in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $DemoSource $part))) {
        throw "Missing demo source: $part in $DemoSource"
    }
}
if (-not (Test-Path -LiteralPath $ZigExe)) { throw "Zig compiler not found: $ZigExe" }
$expectedRevision = 'a9eade1f343764b10fb6dce5fec3828756fad2e6'
if (Test-Path -LiteralPath (Join-Path $DemoSource '.git')) {
    $revision = (& git -C $DemoSource rev-parse HEAD).Trim()
    if ($revision -ne $expectedRevision) {
        Write-Warning "Demo revision $revision differs from tested $expectedRevision; behavior may differ."
    }
}
$output = Join-Path $root 'web-preview\demo_physics.wasm'
& $ZigExe cc -target wasm32-wasi -O2 '-Wl,--no-entry' '-Wl,--export-memory' `
    '-Wl,-z,stack-size=1048576' -I (Join-Path $DemoSource 'include') `
    (Join-Path $DemoSource 'src\kart_dynamics.c') `
    (Join-Path $DemoSource 'src\kart_simulation.c') `
    (Join-Path $DemoSource 'src\kart_camera.c') `
    (Join-Path $DemoSource 'src\kart_demo_data.c') `
    (Join-Path $root 'src-demo\demo_bridge.c') -lm -o $output
if ($LASTEXITCODE -ne 0) { throw 'Demo physics Wasm build failed' }
Write-Output "Local-only demo Wasm built: $output"
