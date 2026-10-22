param([string]$RhoRoot, [string]$PythonExe='python')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'local-asset-paths.ps1')
$RhoRoot=Resolve-LocalRhoRoot $RhoRoot
$root=Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force -Path (Join-Path $root 'local-data') | Out-Null
$reader=Join-Path $root '.tools\rho-reader-upstream'
$revision='37fab6415360afa83e8034f8cedb2cc6766d2fe0'
if (-not (Test-Path -LiteralPath (Join-Path $reader '.git'))) {
  & git clone https://github.com/xpoi5010/Kartrider-File-Reader.git $reader
  if ($LASTEXITCODE -ne 0) { throw 'Native collision reader download failed' }
  & git -C $reader checkout --detach $revision
}
if ((& git -C $reader rev-parse HEAD).Trim() -ne $revision) { throw 'Unexpected collision reader revision' }
# Upstream already decodes this BinaryXmlTag; expose it without changing decoding.
$tex=Join-Path $reader 'src\KartriderLibrary\Game\Engine\Properities\TexProperty.cs'
$text=[IO.File]::ReadAllText($tex)
if (-not $text.Contains('Additional => tmpTag')) {
  if (-not $text.Contains('private BinaryXmlTag tmpTag;')) { throw 'Unexpected TexProperty layout' }
  [IO.File]::WriteAllText($tex,$text.Replace('private BinaryXmlTag tmpTag;','private BinaryXmlTag tmpTag; public BinaryXmlTag? Additional => tmpTag;'))
}
$project=Join-Path $PSScriptRoot 'native-collision-exporter\NativeCollisionExporter.csproj'
$build=Join-Path $root 'local-data\native-collision-build.log'
& dotnet build $project -c Release -p:TargetFramework=net8.0 *> $build
if ($LASTEXITCODE -ne 0) { throw "Native collision exporter build failed; see $build" }
$tool=Join-Path $PSScriptRoot 'native-collision-exporter\bin\Release\net8.0\NativeCollisionExporter.dll'
$run=Join-Path $root ('local-data\native-collision\'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $run | Out-Null
Push-Location $root
try {
  foreach ($track in @('beach_I01','beach_I02','village_R01')) {
    $source=Join-Path $RhoRoot "track\$track\track.1s"
    if (-not (Test-Path -LiteralPath $source)) { throw "Original collision input missing: $source" }
    $prefix=Join-Path $run $track
    & dotnet $tool export $source $prefix *> (Join-Path $root "local-data\native-$track.log")
    if ($LASTEXITCODE -ne 0) { throw "Native track decode failed: $track" }
    & $PythonExe (Join-Path $PSScriptRoot 'align-native-collision.py') "$prefix.ktrk" (Join-Path $root "web-preview\assets\usd\$track")
    if ($LASTEXITCODE -ne 0) { throw "Collision coordinate alignment failed: $track" }
  }
} finally { Pop-Location }
