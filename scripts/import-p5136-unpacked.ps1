param(
    [string]$Archive = 'C:\Users\user\Downloads\kart web\KartRider_5136_01_UNPACK.zip'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$prefix = 'KartRider_5136_01_UNPACK/_rhoOut/'
$assets = @(
    'stage/speedIndiGame/tacho.png',
    'stage/speedIndiGame/tacho_light.png',
    'stage/speedIndiGame/속도_num.png',
    'stage/speedIndiGame/n2o_solo.png',
    'stage/speedIndiGame/n2o_solo_bar.png',
    'stage/speedIndiGame/n2o_solo_full.png',
    'stage/speedIndiGame/n2o_solo_marker.png',
    'stage/speedIndiGame/laptime_box.png',
    'stage/speedIndiGame/laptime_time@zz.png',
    'stage/speedIndiGame/laptime_lap@zz.png',
    'sound/fx/kart/drift.ogg',
    'sound/fx/kart/engine_V1/booster.ogg',
    'sound/fx/kart/engine_V1/boosterDrift.ogg',
    'sound/fx/kart/engine_V1/motor.ogg'
)

$zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
try {
    foreach ($relative in $assets) {
        $entry = $zip.GetEntry($prefix + $relative)
        if ($null -eq $entry) { throw "Missing original asset: $relative" }
        $target = Join-Path $root ('assets/original-ui/' + $relative)
        $directory = Split-Path $target -Parent
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        Write-Output "$relative ($($entry.Length) bytes)"
    }
} finally {
    $zip.Dispose()
}
