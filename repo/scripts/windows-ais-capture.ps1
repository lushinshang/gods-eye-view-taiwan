<#
.SYNOPSIS
  Standalone Taiwan MOTC MPB AIS snapshot capture for Windows (no Node.js
  needed). Polls the public MOTC vessel feed and appends deduplicated
  position rows to daily .ndjson files under D:\trace, in roughly the same
  shape server/providers/vessels/taiwan-tracks.js already writes.

.NOTES
  Why this exists: the MOTC endpoint silently drops TCP connections from
  cloud/datacenter IPs (verified against a Google Cloud e2-micro VM —
  DNS resolved, but the TCP handshake itself timed out). A residential IP
  connects fine. This script is meant to run on a machine with a normal
  home/office internet connection, not a cloud VM.

  Field mapping differs from the main app in one place: "k" here is the
  MOTC "Ship_and_Cargo_Type" numeric code as-is, not the human-readable
  category label the app computes via classifyVesselAgency(). Treat this
  file's "k" as a raw code, not the app's classification.

  Dedup thresholds mirror taiwan-tracks.js: a stationary vessel (SOG < 0.5
  knots) only gets a new row after 30 min AND 0.15 km of movement; a moving
  vessel after 10 min AND 0.03 km. This keeps file size in line with the
  estimates already discussed, instead of rewriting near-identical rows
  every poll.

.USAGE
  Run directly:   powershell -ExecutionPolicy Bypass -File .\windows-ais-capture.ps1
  Stop with Ctrl+C. Designed to be launched once (e.g. by Task Scheduler at
  startup/logon) and left running — it loops forever internally.
#>

$ApiUrl = 'https://mpbais.motcmpb.gov.tw/aismpb/tools/geojsonais.ashx'
$OutDir = 'D:\trace'
$PollIntervalSec = 40
$TaiwanOffsetHours = 8

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

# mmsi -> @{ t = <epoch ms>; lat = <double>; lon = <double> } of the last row
# actually written for that vessel. In-memory only: resets on restart, which
# just means the first poll after a restart may write one extra near-duplicate
# row per vessel — harmless.
$lastPoints = @{}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function ConvertTo-EpochMs {
    param([string]$RecordTime)
    # MOTC "Record_Time" is Taiwan local time, e.g. "2026/11/28 18:05:28".
    # Taiwan has no DST, so a fixed +8h offset is exact, not an approximation.
    $local = [DateTime]::ParseExact($RecordTime, 'yyyy/MM/dd HH:mm:ss', $null)
    $utc = $local.AddHours(-$TaiwanOffsetHours)
    $dto = [DateTimeOffset]::new($utc, [TimeSpan]::Zero)
    return $dto.ToUnixTimeMilliseconds()
}

function Get-DistanceKm {
    param([double]$Lat1, [double]$Lon1, [double]$Lat2, [double]$Lon2)
    $rad = [Math]::PI / 180
    $dLat = ($Lat2 - $Lat1) * $rad
    $dLon = ($Lon2 - $Lon1) * $rad
    $h = [Math]::Sin($dLat / 2) * [Math]::Sin($dLat / 2) +
         [Math]::Cos($Lat1 * $rad) * [Math]::Cos($Lat2 * $rad) *
         [Math]::Sin($dLon / 2) * [Math]::Sin($dLon / 2)
    return 6371 * 2 * [Math]::Asin([Math]::Sqrt([Math]::Min(1, $h)))
}

Write-Host "[$(Get-Date -Format s)] Starting Taiwan AIS capture -> $OutDir (every ${PollIntervalSec}s). Ctrl+C to stop."

while ($true) {
    try {
        $response = Invoke-RestMethod -Uri $ApiUrl -Headers @{ 'Referer' = 'https://mpbais.motcmpb.gov.tw/' } -TimeoutSec 15
        $features = @($response.features)
        $written = 0
        $byFile = @{}

        foreach ($feature in $features) {
            $props = $feature.properties
            $mmsi = [string]$props.MMSI
            if ($mmsi -notmatch '^\d{9}$') { continue }

            $lat = [double]$props.Latitude
            $lon = [double]$props.Longitude
            if ([Math]::Abs($lat) -gt 90 -or [Math]::Abs($lon) -gt 180) { continue }

            $epochMs = ConvertTo-EpochMs -RecordTime $props.Record_Time
            $speed = $props.SOG
            $course = $props.COG
            $kindRaw = $props.Ship_and_Cargo_Type
            $name = $props.ShipName

            $prev = $lastPoints[$mmsi]
            $slow = ($null -ne $speed) -and ($speed -lt 0.5)
            $minKm = if ($slow) { 0.15 } else { 0.03 }
            $minMs = if ($slow) { 1800000 } else { 600000 }

            if ($prev) {
                if ($epochMs -le $prev.t) { continue }
                $deltaMs = $epochMs - $prev.t
                $distKm = Get-DistanceKm -Lat1 $prev.lat -Lon1 $prev.lon -Lat2 $lat -Lon2 $lon
                if ($deltaMs -lt $minMs -and $distKm -lt $minKm) { continue }
            }

            $point = [ordered]@{
                mmsi = $mmsi
                t    = $epochMs
                lat  = [Math]::Round($lat, 5)
                lon  = [Math]::Round($lon, 5)
                s    = $speed
                c    = $course
                k    = $kindRaw
                n    = $name
            }

            $localTs = [DateTimeOffset]::FromUnixTimeMilliseconds($epochMs).ToOffset([TimeSpan]::FromHours($TaiwanOffsetHours))
            $dayName = $localTs.ToString('yyyy-MM-dd')
            if (-not $byFile.ContainsKey($dayName)) {
                $byFile[$dayName] = [System.Collections.Generic.List[string]]::new()
            }
            $byFile[$dayName].Add(($point | ConvertTo-Json -Compress))

            $lastPoints[$mmsi] = @{ t = $epochMs; lat = $lat; lon = $lon }
            $written++
        }

        foreach ($day in $byFile.Keys) {
            $path = Join-Path $OutDir "$day.ndjson"
            $text = ($byFile[$day] -join "`n") + "`n"
            [System.IO.File]::AppendAllText($path, $text, $utf8NoBom)
        }

        Write-Host "[$(Get-Date -Format s)] wrote $written rows ($($features.Count) total in feed)"
    }
    catch {
        Write-Host "[$(Get-Date -Format s)] ERROR: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $PollIntervalSec
}
