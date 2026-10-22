# Shared pinned source/compiler resolution. Dot-source from build/test scripts.
$root = Split-Path -Parent $PSScriptRoot
if (-not $DemoSource) { $DemoSource = Join-Path $root 'third_party\KartriderDemoPhysics' }
$sourceInfo = Get-Content -Raw (Join-Path $root 'third_party\KartriderDemoPhysics\SOURCE.json') | ConvertFrom-Json
foreach ($entry in $sourceInfo.sha256.PSObject.Properties) {
  $file = Join-Path $DemoSource $entry.Name
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing pinned demo file: $file" }
  $text = [IO.File]::ReadAllText($file).Replace("`r`n", "`n")
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $actual = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) }
  finally { $sha.Dispose() }
  if ($actual -ne $entry.Value) { throw "Demo source differs from pinned $($sourceInfo.revision): $($entry.Name)" }
}
if (-not $ZigExe) {
  $ZigExe = Join-Path $root '.tools\zig-windows-x86_64-0.13.0\zig.exe'
  if (-not (Test-Path -LiteralPath $ZigExe) -and (Get-Command zig -ErrorAction SilentlyContinue)) { $ZigExe = (Get-Command zig).Source }
}
if (-not (Test-Path -LiteralPath $ZigExe) -and $Bootstrap) {
  $toolsRoot = Join-Path $root '.tools'
  New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
  $archive = Join-Path $toolsRoot 'zig-0.13.0.zip'
  $release = (Invoke-RestMethod 'https://ziglang.org/download/index.json').'0.13.0'.'x86_64-windows'
  Invoke-WebRequest $release.tarball -OutFile $archive
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $release.shasum) { throw 'Zig download checksum mismatch' }
  Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
}
if (-not (Test-Path -LiteralPath $ZigExe)) { throw 'Zig 0.13.0 missing. Use -Bootstrap or -ZigExe C:\path\zig.exe' }
if ((& $ZigExe version).Trim() -ne '0.13.0') { throw 'This build requires Zig 0.13.0.' }
