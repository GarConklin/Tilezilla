<#
.SYNOPSIS
  Pull solver farm results (pushed by the manager VM to branch solver-results/<Set>) into this working tree.

.DESCRIPTION
  Fetches origin/solver-results/<Set> without switching branches, then copies into
  tools/data/swap-candidates/<Set>/:
    results/<id>.json             (gzipped .json.gz files from the farm are unpacked to .json)
    results-progress.ndjson       (merged by puzzle id with any local lines; farm wins)
    farm-results.ndjson, farm-status.txt, farm-status.json  (replaced)
  Nothing is staged or committed. Shows the farm status snapshot at the end.

.EXAMPLE
  .\tools\swarm\fetch-results.ps1 -Set pair-swap-drafts

.EXAMPLE
  .\tools\swarm\fetch-results.ps1 -Set pair-swap-drafts -StatusOnly
#>
param(
  [Parameter(Mandatory = $true)][string]$Set,
  [switch]$StatusOnly,
  [switch]$KeepGz
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
$Branch = "solver-results/$Set"
$SetRel = "tools/data/swap-candidates/$Set"
$Dest = Join-Path $RepoRoot ($SetRel -replace '/', '\')

Write-Host "==> Fetching origin/$Branch" -ForegroundColor Cyan
& git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Could not fetch $Branch - has the manager VM run export-publish.sh for '$Set' yet?" }
$commit = (& git rev-parse --short FETCH_HEAD).Trim()
Write-Host "    farm results commit $commit ($(& git log -1 --format='%cd  %s' --date=format:'%Y-%m-%d %H:%M' FETCH_HEAD))"

if ($StatusOnly) {
  & git show "FETCH_HEAD:$SetRel/farm-status.txt"
  return
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) "tz-farm-results-$Set-$commit"
$tar = "$tmp.tar"
Remove-Item -Recurse -Force $tmp, $tar -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Write-Host "==> Unpacking"
& git archive --format=tar -o $tar FETCH_HEAD $SetRel
if ($LASTEXITCODE -ne 0) { throw "git archive failed (is there anything under $SetRel on the branch yet?)" }
& tar -xf $tar -C $tmp
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
$src = Join-Path $tmp ($SetRel -replace '/', '\')

New-Item -ItemType Directory -Force -Path (Join-Path $Dest "results") | Out-Null
$copied = 0; $unzipped = 0; $same = 0
$srcResults = Join-Path $src "results"
if (Test-Path $srcResults) {
  foreach ($f in Get-ChildItem $srcResults -File) {
    if ($f.Name.EndsWith(".json.gz") -and -not $KeepGz) {
      $target = Join-Path $Dest ("results\" + $f.Name.Substring(0, $f.Name.Length - 3))
      if ((Test-Path $target) -and (Get-Item $target).LastWriteTime -ge $f.LastWriteTime) { $same++; continue }
      $in = [IO.File]::OpenRead($f.FullName)
      try {
        $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
        $out = [IO.File]::Create($target)
        try { $gz.CopyTo($out) } finally { $out.Close(); $gz.Close() }
      } finally { $in.Close() }
      $unzipped++
    } else {
      $target = Join-Path $Dest ("results\" + $f.Name)
      if ((Test-Path $target) -and (Get-Item $target).Length -eq $f.Length) { $same++; continue }
      Copy-Item $f.FullName $target -Force
      $copied++
    }
  }
}
Write-Host "    results: $copied copied, $unzipped unpacked from .gz, $same already up to date -> $Dest\results"

$farmProgress = Join-Path $src "results-progress.ndjson"
if (Test-Path $farmProgress) {
  $localProgress = Join-Path $Dest "results-progress.ndjson"
  $farmLines = @(Get-Content $farmProgress | Where-Object { $_.Trim() })
  $farmIds = @{}
  foreach ($l in $farmLines) { try { $farmIds[($l | ConvertFrom-Json).id] = $true } catch { } }
  $keep = @()
  if (Test-Path $localProgress) {
    foreach ($l in Get-Content $localProgress) {
      if (-not $l.Trim()) { continue }
      try { if (-not $farmIds.ContainsKey(($l | ConvertFrom-Json).id)) { $keep += $l } } catch { $keep += $l }
    }
  }
  [IO.File]::WriteAllLines($localProgress, [string[]](@($keep) + $farmLines), (New-Object Text.UTF8Encoding($false)))
  Write-Host "    results-progress.ndjson: $($farmLines.Count) farm line(s) + $($keep.Count) local-only line(s)"
}
foreach ($name in "farm-results.ndjson", "farm-status.txt", "farm-status.json", "too-big.txt") {
  $p = Join-Path $src $name
  if (Test-Path $p) { Copy-Item $p (Join-Path $Dest $name) -Force }
}
Remove-Item -Recurse -Force $tmp, $tar -ErrorAction SilentlyContinue

$status = Join-Path $Dest "farm-status.txt"
if (Test-Path $status) {
  Write-Host ""
  Write-Host "==> Farm status at the time of that push" -ForegroundColor Cyan
  Get-Content $status
}
if (Test-Path (Join-Path $Dest "too-big.txt")) {
  Write-Host "Some results were too big for GitHub and are still on the manager VM - see $Dest\too-big.txt" -ForegroundColor Yellow
}
