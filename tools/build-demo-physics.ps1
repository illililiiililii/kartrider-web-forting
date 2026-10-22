param(
    [string]$DemoSource,
    [string]$ZigExe,
    [string]$RhoRoot = 'C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK\KartRider_5136_01_UNPACK\_rhoOut'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$workspaceWork = Join-Path (Resolve-Path (Join-Path $root '..\..')) 'work'
if (-not $DemoSource) {
    $suppliedDemo = 'C:\Users\user\Downloads\KartriderDemoPhysics-main\KartriderDemoPhysics-main'
    $DemoSource = if (Test-Path -LiteralPath $suppliedDemo -PathType Container) {
        $suppliedDemo
    } else {
        Join-Path $workspaceWork 'reference-demo-physics'
    }
}
if (-not $ZigExe) { $ZigExe = Join-Path $workspaceWork 'zig-windows-x86_64-0.13.0\zig.exe' }
$required = @('include\kart_simulation.h', 'include\kart_dynamics.h', 'include\kart_camera.h',
    'src\kart_dynamics.c', 'src\kart_simulation.c', 'src\kart_camera.c',
    'include\kart_demo_data.h', 'src\kart_demo_data.c',
    'include\kart_track_scene.h', 'src\kart_track_scene.c',
    'include\kart_track_collision.h', 'src\kart_track_collision.c',
    'src\kart_inflate.c',
    'include\kart_countdown.h', 'src\kart_countdown.c',
    'include\kart_course.h', 'src\kart_course.c', 'src\kart_course_data.c',
    'include\kart_engine_sound.h', 'src\kart_engine_sound.c',
    'include\kart_input.h', 'src\kart_input.c',
    'demo\kart_gauge.h')
foreach ($part in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $DemoSource $part))) {
        throw "Missing demo source: $part in $DemoSource"
    }
}
if (-not (Test-Path -LiteralPath $ZigExe)) { throw "Zig compiler not found: $ZigExe" }
Write-Output "Demo source: $DemoSource"
$expectedRevision = 'a9eade1f343764b10fb6dce5fec3828756fad2e6'
if (Test-Path -LiteralPath (Join-Path $DemoSource '.git')) {
    $revision = (& git -C $DemoSource rev-parse HEAD).Trim()
    if ($revision -ne $expectedRevision) {
        Write-Warning "Demo revision $revision differs from tested $expectedRevision; behavior may differ."
    }
}
$output = Join-Path $root 'web-preview\demo_physics.wasm'
$generatedCourse = Join-Path $root 'src-demo\generated_5136_course.c'
& python (Join-Path $PSScriptRoot 'prepare-local-course.py') `
    --demo-source $DemoSource --rho-root $RhoRoot --output $generatedCourse
if ($LASTEXITCODE -ne 0) { throw 'P5136 local course extraction failed' }
& $ZigExe cc -target wasm32-wasi -O2 '-Wl,--no-entry' '-Wl,--export-memory' `
    '-Wl,-z,stack-size=1048576' -I (Join-Path $DemoSource 'include') -I (Join-Path $DemoSource 'demo') `
    (Join-Path $DemoSource 'src\kart_dynamics.c') `
    (Join-Path $DemoSource 'src\kart_simulation.c') `
    (Join-Path $DemoSource 'src\kart_camera.c') `
    (Join-Path $DemoSource 'src\kart_demo_data.c') `
    (Join-Path $DemoSource 'src\kart_track_scene.c') `
    (Join-Path $DemoSource 'src\kart_track_collision.c') `
    (Join-Path $DemoSource 'src\kart_inflate.c') `
    (Join-Path $DemoSource 'src\kart_countdown.c') `
    (Join-Path $DemoSource 'src\kart_course.c') `
    (Join-Path $DemoSource 'src\kart_course_data.c') `
    (Join-Path $DemoSource 'src\kart_engine_sound.c') `
    (Join-Path $DemoSource 'src\kart_input.c') `
    $generatedCourse `
    (Join-Path $root 'src-demo\demo_bridge.c') -lm -o $output
if ($LASTEXITCODE -ne 0) { throw 'Demo physics Wasm build failed' }
Write-Output "Local-only demo Wasm built: $output"
