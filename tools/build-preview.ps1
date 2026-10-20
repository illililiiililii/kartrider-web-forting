$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Resolve-Path (Join-Path $projectRoot '..\..')
$env:CARGO_HOME = Join-Path $workspaceRoot 'work\.toolchains\cargo'
$env:RUSTUP_HOME = Join-Path $workspaceRoot 'work\.toolchains\rustup'
$env:PATH = "$(Join-Path $env:CARGO_HOME 'bin');$env:PATH"
$targetDirectory = Join-Path $workspaceRoot 'work\kart-web-target'
Push-Location $projectRoot
try {
    cargo build --target wasm32-unknown-unknown --release --target-dir $targetDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Wasm build failed' }
    Copy-Item -LiteralPath (Join-Path $targetDirectory 'wasm32-unknown-unknown\release\p5136_wasm_core.wasm') -Destination (Join-Path $projectRoot 'web-preview\p5136_wasm_core.wasm') -Force
} finally {
    Pop-Location
}
