param(
    [Parameter(Mandatory = $true)]
    [string]$TelemetryPath,
    [Parameter(Mandatory = $true)]
    [string]$EventsPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

function Find-EventQpc {
    param(
        [object[]]$Events,
        [string]$Phase,
        [string]$Key,
        [string]$Event
    )

    $match = $Events | Where-Object {
        $_.phase -eq $Phase -and $_.key -eq $Key -and $_.event -eq $Event
    } | Select-Object -First 1
    if ($null -eq $match) {
        throw "Missing event boundary: phase=$Phase key=$Key event=$Event"
    }
    return [UInt64]$match.qpc
}

function Get-Speed {
    param([object]$Row)
    $x = [double]$Row.f00c0
    $y = [double]$Row.f00c4
    $z = [double]$Row.f00c8
    return [Math]::Sqrt($x * $x + $y * $y + $z * $z)
}

$events = @(Import-Csv -LiteralPath $EventsPath)
$telemetry = @(Import-Csv -LiteralPath $TelemetryPath)

$straightStart = Find-EventQpc $events 'straight-4s' '0x26' 'down'
$leftStart = Find-EventQpc $events 'left-drift-1s' '0x25' 'down'
$recoveryStart = Find-EventQpc $events 'recovery-2s' '0x26' 'down'
$rightStart = Find-EventQpc $events 'right-drift-1s' '0x27' 'down'
$coastStart = Find-EventQpc $events 'right-drift-1s' '0x10' 'up'
$boostStart = Find-EventQpc $events 'booster-200ms' '0x11' 'down'
$brakeStart = Find-EventQpc $events 'brake-1500ms' '0x28' 'down'
$captureEnd = Find-EventQpc $events 'brake-1500ms' '0x28' 'up'

$boundaries = @(
    [pscustomobject]@{ Name = 'straight'; Start = $straightStart; End = $leftStart },
    [pscustomobject]@{ Name = 'left-drift'; Start = $leftStart; End = $recoveryStart },
    [pscustomobject]@{ Name = 'recovery'; Start = $recoveryStart; End = $rightStart },
    [pscustomobject]@{ Name = 'right-drift'; Start = $rightStart; End = $coastStart },
    [pscustomobject]@{ Name = 'coast'; Start = $coastStart; End = $boostStart },
    [pscustomobject]@{ Name = 'boost-window'; Start = $boostStart; End = $brakeStart },
    [pscustomobject]@{ Name = 'brake'; Start = $brakeStart; End = $captureEnd + 1 }
)

$rows = foreach ($row in $telemetry) {
    $qpc = [UInt64]$row.qpc
    if ($qpc -lt $straightStart -or $qpc -gt $captureEnd) {
        continue
    }
    $boundary = $boundaries | Where-Object { $qpc -ge $_.Start -and $qpc -lt $_.End } | Select-Object -First 1
    if ($null -eq $boundary) {
        continue
    }
    $row | Add-Member -NotePropertyName phase -NotePropertyValue $boundary.Name -PassThru
}

if ($rows.Count -eq 0) {
    throw 'No telemetry rows overlap the controlled input interval.'
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$tracePath = Join-Path $OutputDirectory 'original-controlled-04.csv'
$summaryPath = Join-Path $OutputDirectory 'original-controlled-04-summary.csv'
$eventsOutputPath = Join-Path $OutputDirectory 'controlled-input-events-04.csv'

$rows | Export-Csv -LiteralPath $tracePath -NoTypeInformation -Encoding utf8
Copy-Item -LiteralPath $EventsPath -Destination $eventsOutputPath -Force

$summary = foreach ($boundary in $boundaries) {
    $phaseRows = @($rows | Where-Object { $_.phase -eq $boundary.Name })
    if ($phaseRows.Count -eq 0) {
        continue
    }
    $first = $phaseRows[0]
    $last = $phaseRows[-1]
    $speeds = @($phaseRows | ForEach-Object { Get-Speed $_ })
    $gauges = @($phaseRows | ForEach-Object { [double]$_.booster_gauge })
    [pscustomobject]@{
        phase = $boundary.Name
        samples = $phaseRows.Count
        duration_ms = ([UInt64]$last.client_time_ms - [UInt64]$first.client_time_ms)
        speed_start = $speeds[0]
        speed_end = $speeds[-1]
        speed_max = ($speeds | Measure-Object -Maximum).Maximum
        booster_gauge_start = $gauges[0]
        booster_gauge_end = $gauges[-1]
        booster_gauge_max = ($gauges | Measure-Object -Maximum).Maximum
        delta_x = ([double]$last.f0090 - [double]$first.f0090)
        delta_y = ([double]$last.f0094 - [double]$first.f0094)
        delta_z = ([double]$last.f0098 - [double]$first.f0098)
    }
}
$summary | Export-Csv -LiteralPath $summaryPath -NoTypeInformation -Encoding utf8

Write-Output $tracePath
Write-Output $summaryPath
Write-Output $eventsOutputPath
