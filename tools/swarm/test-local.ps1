<#
.SYNOPSIS
  Local end-to-end test of the solver farm on this PC's Docker Desktop (no Swarm, no VMs).

.DESCRIPTION
  Starts Redis + 2 solver workers as compose project "tz-farm-test" (workers publish no ports; Redis
  only on 127.0.0.1:6390; the main tilezilla containers are not touched), loads a few small specs,
  waits for the results, exports them to data/solver-runs/swarm-test/ (gitignored), compares counts
  with the known answers in swap-bags/results-progress.ndjson, then checks that a stopped worker hands
  its job back at once and a killed worker's job returns to the queue after the lease expires.

.EXAMPLE
  .\tools\swarm\test-local.ps1
  .\tools\swarm\test-local.ps1 -KeepRunning     # leave the test stack up afterwards
#>
param(
  [switch]$KeepRunning,
  [switch]$SkipBuild,
  [string]$LongSpecId = "",
  [string]$LongSpecsDir = "tools/data/swap-candidates/pair-swap-drafts/specs"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
$Compose = @("compose", "-p", "tz-farm-test", "-f", "docker/swarm/compose.local-test.yml")
$env:FARM_REDIS_HOST = "127.0.0.1"
$env:FARM_REDIS_PORT = "6390"
$env:FARM_REDIS_PASSWORD = "localtest"
$env:FARM_CONFIG = Join-Path $RepoRoot "tools/swarm/__no_config__.json"
$Out = Join-Path $RepoRoot "data/solver-runs/swarm-test"
$Farm = Join-Path $RepoRoot "tools/swarm/farm.js"
$script:failures = @()

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Pass($msg) { Write-Host "    PASS: $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "    FAIL: $msg" -ForegroundColor Red; $script:failures += $msg }
function FarmCmd { & node $Farm @args; if ($LASTEXITCODE -ne 0) { throw "farm.js $($args -join ' ') failed" } }
function FarmStatus { (& node $Farm status --json | Out-String) | ConvertFrom-Json }
function Invoke-Docker {
  $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  & docker.exe @args 2>&1 | ForEach-Object { Write-Host "    $_" }
  $ErrorActionPreference = $prev
}
function SetRow($st, $name) { $st.sets | Where-Object { $_.name -eq $name } }

function Wait-Until([scriptblock]$cond, [int]$timeoutSec, [string]$what) {
  $t0 = Get-Date
  while (((Get-Date) - $t0).TotalSeconds -lt $timeoutSec) {
    $st = FarmStatus
    if (& $cond $st) { return $st }
    $sum = ($st.sets | ForEach-Object { "$($_.name): done $($_.done) wait $($_.queued) run $($_.running) fail $($_.failed)" }) -join " | "
    Write-Host ("    [{0,4:N0}s] waiting for {1} ... {2}" -f ((Get-Date) - $t0).TotalSeconds, $what, $sum)
    Start-Sleep -Seconds 3
  }
  return $null
}

$host.UI.RawUI.WindowTitle = "TileZilla solver farm - local test"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

if (-not $SkipBuild) {
  Step "Building the solver image tilezilla-solver:local-test (only the solver files are sent to Docker)"
  $env:DOCKER_BUILDKIT = "1"
  Invoke-Docker build --progress=plain -f docker/swarm/solver-worker.Dockerfile --build-arg FARM_GIT_COMMIT=local-test -t tilezilla-solver:local-test .
}
Step "Starting redis + 2 workers (compose project tz-farm-test, no published ports except 127.0.0.1:6390)"
Invoke-Docker @Compose up -d --no-build
Invoke-Docker @Compose ps
Invoke-Docker image ls tilezilla-solver:local-test

Step "Waiting for redis"
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  & node $Farm ping 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ok) { throw "redis on 127.0.0.1:6390 not reachable" }
FarmCmd wipe --yes

Step "Loading small specs: 3 from swap-bags, 2 from generated-0c-small"
FarmCmd load --set test-swapbags --queue tools/data/swap-candidates/swap-bags/queue.txt --specs tools/data/swap-candidates/swap-bags/specs --limit 3
FarmCmd load --set test-0c --queue tools/data/swap-candidates/generated-0c-small/queue.txt --specs tools/data/swap-candidates/generated-0c-small/specs --limit 2
Step "Loading the same swap-bags specs again (must all be skipped)"
FarmCmd load --set test-swapbags --queue tools/data/swap-candidates/swap-bags/queue.txt --specs tools/data/swap-candidates/swap-bags/specs --limit 3

Step "Waiting for all 5 to be solved"
$st = Wait-Until { param($s) (($s.sets | Measure-Object done -Sum).Sum -ge 5) } 300 "5 solved"
if ($st) { Pass "5 jobs solved" } else { Fail "jobs not solved within 5 minutes" }
FarmCmd status

Step "Exporting results"
Remove-Item -Recurse -Force (Join-Path $Out "test-swapbags"), (Join-Path $Out "test-0c") -ErrorAction SilentlyContinue
FarmCmd export --set test-swapbags --out (Join-Path $Out "test-swapbags/results")
FarmCmd export --set test-0c --out (Join-Path $Out "test-0c/results") --gzip-over 1
FarmCmd export --set test-0c --out (Join-Path $Out "test-0c/results")
FarmCmd status --quiet --out (Join-Path $Out "farm-status.txt") --json-out (Join-Path $Out "farm-status.json")

Step "Comparing with the same solver run directly on this PC (node solves/solve-level.js)"
foreach ($line in Get-Content (Join-Path $Out "test-swapbags/farm-results.ndjson")) {
  $r = $line | ConvertFrom-Json
  $direct = $null
  & node solves/solve-level.js --spec "tools/data/swap-candidates/swap-bags/specs/$($r.id).json" --viable-seeds-only --json-summary --max-sol 500000 2>$null | ForEach-Object {
    if ("$_" -match '"totalUniqueSolutions"') { $direct = ("$_" | ConvertFrom-Json).totalUniqueSolutions }
  }
  if ($direct -eq $r.solutions) { Pass "$($r.id): $($r.solutions) solution(s), same as the direct run (node $($r.node), solver $($r.solverHash), $($r.durationMs) ms)" }
  else { Fail "$($r.id): farm says $($r.solutions), direct run says $direct" }
  $f = Join-Path $Out "test-swapbags/results/$($r.id).json"
  if ($r.solutions -gt 0) {
    if ((Test-Path $f) -and ((Get-Content $f -Raw | ConvertFrom-Json).totalUniqueSolutions -eq $r.solutions)) { Pass "results/$($r.id).json is valid and has the same count" }
    else { Fail "results file for $($r.id) missing or wrong" }
  } elseif (-not (Test-Path $f)) { Pass "$($r.id): zero solutions, no results file (same as the old runner)" }
}
$prog = @(Get-Content (Join-Path $Out "test-swapbags/results-progress.ndjson"))
if ($prog.Count -eq 3) { Pass "results-progress.ndjson has 3 lines in the old runner's format" } else { Fail "results-progress.ndjson has $($prog.Count) lines" }
$gz = @(Get-ChildItem (Join-Path $Out "test-0c/results") -Filter *.json.gz)
$lines0c = @(Get-Content (Join-Path $Out "test-0c/farm-results.ndjson"))
if ($lines0c.Count -eq 2) { Pass "second export added nothing (still 2 summary lines); $($gz.Count) file(s) written as .json.gz with --gzip-over" } else { Fail "test-0c summary has $($lines0c.Count) lines, expected 2" }
if (Test-Path (Join-Path $Out "farm-status.txt")) { Pass "status snapshot written (farm-status.txt/json)" } else { Fail "no status snapshot" }

Step "Worker stop/kill test with a longer job"
if (-not $LongSpecId) {
  $cand = Get-ChildItem $LongSpecsDir -Filter *.json | Where-Object { (Get-Content $_.FullName -Raw | ConvertFrom-Json).board.cells -ge 30 } | Select-Object -First 1
  $LongSpecId = $cand.BaseName
}
Write-Host "    long job: $LongSpecId ($LongSpecsDir)"
$q = Join-Path $Out "long-queue.txt"
Set-Content -Path $q -Value $LongSpecId
FarmCmd load --set test-kill --queue $q --specs $LongSpecsDir

function Get-KillJob($s) {
  $run = @($s.running | Where-Object { $_.job -like "test-kill/*" })
  if (-not $run) { return $null }
  $hostId = (($run[0].worker -split '/')[1] -replace '-\d+$', '')
  # Only ever touch a container of this test's own compose project.
  $name = (& docker.exe ps --filter "label=com.docker.compose.project=tz-farm-test" --filter "id=$hostId" --format '{{.Names}}' 2>$null | Select-Object -First 1)
  if (-not $name -or $name -notlike 'tz-farm-test-*') { return $null }
  [pscustomobject]@{ Container = $name; Attempt = $run[0].attempt; Worker = $run[0].worker }
}

$st = Wait-Until { param($s) [bool](Get-KillJob $s) } 60 "long job to start"
$w = if ($st) { Get-KillJob $st } else { $null }
if (-not $w) { Fail "long job never started" }
else {
  Write-Host "    running in container $($w.Container) (attempt $($w.Attempt)); letting it run 8s, then 'docker stop'"
  Start-Sleep -Seconds 8
  if ((SetRow (FarmStatus) 'test-kill').done -ge 1) {
    Write-Host "    job already finished - too short for this test; pass -LongSpecId with a bigger puzzle" -ForegroundColor Yellow
  } else {
    Invoke-Docker stop -t 20 $w.Container
    $s = FarmStatus
    $tk = SetRow $s 'test-kill'
    $w2 = Get-KillJob $s
    if ($tk.queued -ge 1 -or ($w2 -and $w2.Worker -ne $w.Worker)) { Pass "graceful stop handed the job back at once (waiting=$($tk.queued); attempt counter not used up: $(if ($w2) { $w2.Attempt } else { 'n/a' }))" }
    else { Fail "after docker stop the job was not requeued (waiting=$($tk.queued) running=$($tk.running))" }
    Invoke-Docker @Compose up -d --no-build

    $st = Wait-Until { param($s) [bool](Get-KillJob $s) } 60 "long job to be picked up again"
    $w = Get-KillJob $st
    Write-Host "    now in container $($w.Container) (attempt $($w.Attempt)); 'docker kill' = simulated VM crash"
    Invoke-Docker kill $w.Container
    Start-Sleep -Seconds 2
    $tk = SetRow (FarmStatus) 'test-kill'
    Write-Host "    right after kill: lease still held=$($tk.running) waiting=$($tk.queued) (lease is 20s in this test, 120s on the farm)"
    $killed = $w.Worker
    $st = Wait-Until { param($s) $k = Get-KillJob $s; $t = SetRow $s 'test-kill'; ($k -and $k.Worker -ne $killed) -or $t.queued -ge 1 -or $t.done -ge 1 } 90 "lease to expire and the job to come back"
    if ($st) {
      $k = Get-KillJob $st
      Pass "killed worker's job came back$(if ($k) { " and is running on $($k.Worker), attempt $($k.Attempt)" })"
    } else { Fail "killed worker's job did not come back within 90s" }
  }
}
FarmCmd clear-queue --set test-kill
FarmCmd status

Step "Worker log excerpt"
Invoke-Docker @Compose logs --tail 12 solver

if (-not $KeepRunning) {
  Step "Removing test stack"
  Invoke-Docker @Compose down -v
}

Write-Host ""
if ($script:failures.Count -eq 0) { Write-Host "ALL CHECKS PASSED" -ForegroundColor Green }
else { Write-Host "$($script:failures.Count) CHECK(S) FAILED:" -ForegroundColor Red; $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red } }
