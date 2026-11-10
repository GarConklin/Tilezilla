<#
.SYNOPSIS
  Nightly fast solver run on this PC. You run this from C:\Tilezilla-Test.

.DESCRIPTION
    .\tools\scripts\run-nightly-solves.ps1 -Workers 8 -Until "2026-11-11 07:00"

  1. Imports the waiting list from the old copy (read-only): pending puzzles and their specs, minus everything
     the old ledger already has. Re-running picks up new pending/done items.
  2. Solves the pair-swap drafts first, then the old waiting list smallest boards first (5x6-0A, then 5x6-0B).
     Plain Node on Windows, no Docker, no ports, so it never touches the old run's containers.
  3. Saves every result the moment it finishes, so closing the window loses at most the puzzles in progress.
     Run the same command again to carry on.

  Stop starting new puzzles at -Until; puzzles still running get -GraceMinutes to finish, then go back in the queue.
  Ctrl+C once does nothing but ask; Ctrl+C again within 10 s stops at once (puzzles in progress go back in the queue).
  While it runs the PC is kept awake and QuickEdit is off for the window (clicking can't freeze it).
  If the runner exits unexpectedly before -Until it is restarted after 15 s (logs\wrapper-*.log says why).
  From another window:
    .\tools\scripts\run-nightly-solves.ps1 -Stop      finish the puzzles in progress, then stop
    .\tools\scripts\watch-nightly-solves.ps1          live view
    .\tools\scripts\export-nightly-solves.ps1         file for the old ledger (record-many)

  -Limit / -PerGroup cap how many puzzles this run starts (for test runs).
#>
param(
  [int]$Workers = 8,
  [string]$Until = "",
  [int]$Limit = 0,
  [int]$PerGroup = 0,
  [double]$GraceMinutes = 10,
  [double]$TimeoutMinutes = 60,
  [switch]$RetryFailed,
  [switch]$SkipImport,
  [switch]$SkipOldRunResults,
  [switch]$Stop,
  [string]$OldRepo = "C:\Users\~Gar\Tile-Puzzle\Tilezilla"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $RepoRoot
$script = "tools/scripts/nightly-solves.js"

if ($Stop) { & node $script stop; exit $LASTEXITCODE }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed (needed to run the solver). Install it from https://nodejs.org and try again." -ForegroundColor Red
  exit 1
}

$untilArg = @()
if (-not [string]::IsNullOrWhiteSpace($Until)) {
  $deadline = [datetime]::ParseExact($Until.Trim(), "yyyy-MM-dd HH:mm", [Globalization.CultureInfo]::InvariantCulture)
  if ($deadline -le (Get-Date)) { throw "Until time is already past: $Until" }
  $untilArg = @("--until", $deadline.ToString("o"))
}

$host.UI.RawUI.WindowTitle = "TileZilla nightly solves ($Workers workers$(if ($Until) { ", until $Until" }))"
$stateDir = Join-Path $RepoRoot "tools\data\solver-runs\nightly"
New-Item -ItemType Directory -Path (Join-Path $stateDir "logs") -Force | Out-Null

if (-not $SkipImport) {
  $importLog = Join-Path $stateDir ("logs\import-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
  Write-Host "Step 1/2: importing the waiting list from the old copy (read-only)..." -ForegroundColor Cyan
  $importArgs = @($script, "import", "--old", $OldRepo)
  if ($SkipOldRunResults) { $importArgs += "--skip-old-run-results" }
  & node @importArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $importLog
  if ($LASTEXITCODE -ne 0) { Write-Host "Import failed (see $importLog)." -ForegroundColor Red; exit 1 }
}

$runArgs = @($script, "run", "--workers", "$Workers", "--grace-min", "$GraceMinutes", "--timeout-min", "$TimeoutMinutes") + $untilArg
if ($Limit -gt 0) { $runArgs += @("--limit", "$Limit") }
if ($PerGroup -gt 0) { $runArgs += @("--per-group", "$PerGroup") }
if ($RetryFailed) { $runArgs += "--retry-failed" }

$wrapperLog = Join-Path $stateDir ("logs\wrapper-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
function Note([string]$msg, [string]$color = "Gray") {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $wrapperLog -Value $line
  Write-Host $line -ForegroundColor $color
}

Add-Type -Namespace TileZilla -Name Win32 -MemberDefinition @"
[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);
[DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr h, out uint mode);
[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr h, uint mode);
public delegate bool CtrlHandler(uint ctrlType);
[DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(CtrlHandler h, bool add);
// Ctrl+C / Ctrl+Break are for the runner (it asks for a second press); PowerShell itself ignores them,
// otherwise one Ctrl+C would quietly end this script's restart loop.
public static readonly CtrlHandler IgnoreBreak = t => t <= 1;
"@ -ErrorAction SilentlyContinue

# Keep the PC awake (the screen may still turn off). ES_CONTINUOUS | ES_SYSTEM_REQUIRED.
$awake = [TileZilla.Win32]::SetThreadExecutionState([uint32]2147483649) -ne 0
# QuickEdit off: clicking in the window would otherwise select text and freeze the run until Enter/Esc.
$stdin = [TileZilla.Win32]::GetStdHandle(-10)
$oldMode = [uint32]0
$quickEditOff = $false
if ([TileZilla.Win32]::GetConsoleMode($stdin, [ref]$oldMode)) {
  $newMode = [uint32](([int64]$oldMode -bor 0x80) -band 0xFFFFFFBF)
  $quickEditOff = [TileZilla.Win32]::SetConsoleMode($stdin, $newMode)
}
$ctrlGuard = [TileZilla.Win32]::SetConsoleCtrlHandler([TileZilla.Win32]::IgnoreBreak, $true)
Note ("Step 2/2: solving. Sleep blocked: {0}. QuickEdit off: {1}. Wrapper log: {2}" -f $awake, $quickEditOff, $wrapperLog) Cyan

$restarts = 0
$quickFails = 0
try {
  while ($true) {
    $t0 = Get-Date
    & node @runArgs
    $code = $LASTEXITCODE
    if ($code -eq 0) { Note "Runner finished normally (exit 0)." Green; break }
    if ($code -eq 130) { Note "Runner stopped by you (Ctrl+C twice or window closed)." Yellow; break }
    if ($code -eq 2 -or $code -eq 3) { Note "Runner did not start (exit $code): see the message above." Red; break }
    if ($deadline -and (Get-Date) -ge $deadline) { Note "Runner exited (code $code) after the -Until time; not restarting." Yellow; break }
    if (((Get-Date) - $t0).TotalSeconds -lt 60) { $quickFails++ } else { $quickFails = 0 }
    if ($quickFails -ge 5) { Note "Runner crashed 5 times in a row within a minute of starting (last exit $code). Giving up; see the run log." Red; break }
    $restarts++
    Note "Runner exited unexpectedly (exit code $code). Restart #$restarts in 15 s; saved results are kept and in-flight puzzles go back in the queue." Red
    Start-Sleep -Seconds 15
  }
}
finally {
  if ($ctrlGuard) { [void][TileZilla.Win32]::SetConsoleCtrlHandler([TileZilla.Win32]::IgnoreBreak, $false) }
  if ($quickEditOff) { [void][TileZilla.Win32]::SetConsoleMode($stdin, $oldMode) }
  if ($awake) { [void][TileZilla.Win32]::SetThreadExecutionState([uint32]2147483648) }
  Note "Wrapper exiting (restarts this session: $restarts)."
}
& node $script status
