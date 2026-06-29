<#
.SYNOPSIS
  Ensure one shared MySQL Docker volume for all Tilezilla compose stacks.

.DESCRIPTION
  Plain docker-compose.yml and docker-compose.remote-test.yml both mount
  tilezilla_shared_mysql_data on container garz-puzzle-mysql.

  On first run, if the shared volume is missing or has no tilegame login accounts,
  copies data from the best legacy volume (prefers remote-test volumes that
  contain registered accounts).

.EXAMPLE
  .\scripts\ensure-shared-mysql-volume.ps1
#>
[CmdletBinding()]
param(
  [switch]$ForceCopyFromLegacy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SharedVolume = "tilezilla_shared_mysql_data"
$LegacyVolumes = @(
  "tilezilla-test_tilezilla_remote_mysql_data",
  "tilezilla_tilezilla_remote_mysql_data",
  "tilezilla-test_tilegame_mysql_data",
  "garz-puzzle_tilegame_mysql_data"
)

function Test-DockerVolumeExists([string]$Name) {
  try {
    docker volume inspect $Name 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  }
  catch {
    return $false
  }
}

function Get-TilegameUserCount([string]$VolumeName) {
  if (-not (Test-DockerVolumeExists $VolumeName)) {
    return -1
  }

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"

  $cid = docker run -d `
    --rm `
    -v "${VolumeName}:/var/lib/mysql" `
    -e "MYSQL_ROOT_PASSWORD=root_dev_change_me" `
    mysql:8.4 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $cid) {
    $ErrorActionPreference = $prevEap
    return -1
  }

  try {
    $deadline = (Get-Date).AddSeconds(45)
    do {
      Start-Sleep -Seconds 2
      docker exec $cid mysqladmin ping -h 127.0.0.1 -uroot -proot_dev_change_me 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { break }
    } while ((Get-Date) -lt $deadline)

    $sql = "SELECT COUNT(*) FROM tilegame.users;"
    $raw = docker exec $cid mysql -uroot -proot_dev_change_me -N -e $sql 2>$null
    if ($LASTEXITCODE -ne 0) {
      return 0
    }
    return [int]($raw.Trim())
  }
  finally {
    docker rm -f $cid 2>$null | Out-Null
    $ErrorActionPreference = $prevEap
  }
}

function Copy-DockerVolume([string]$From, [string]$To) {
  Write-Host "Copying MySQL data: $From -> $To" -ForegroundColor Yellow
  docker volume create $To | Out-Null
  docker run --rm `
    -v "${From}:/from:ro" `
    -v "${To}:/to" `
    alpine sh -c "cp -a /from/. /to/" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Volume copy failed ($From -> $To)"
  }
}

Write-Host "Checking shared MySQL volume: $SharedVolume" -ForegroundColor Cyan

$sharedExists = Test-DockerVolumeExists $SharedVolume
$sharedUsers = if ($sharedExists) { Get-TilegameUserCount $SharedVolume } else { -1 }

$bestLegacy = $null
$bestLegacyUsers = -1
foreach ($legacy in $LegacyVolumes) {
  if (-not (Test-DockerVolumeExists $legacy)) { continue }
  $count = Get-TilegameUserCount $legacy
  Write-Host "  legacy $legacy -> login accounts = $count"
  if ($count -gt $bestLegacyUsers) {
    $bestLegacy = $legacy
    $bestLegacyUsers = $count
  }
}

$needCopy = $false
if (-not $sharedExists) {
  Write-Host "Shared volume does not exist yet." -ForegroundColor Yellow
  $needCopy = $true
}
elseif ($ForceCopyFromLegacy) {
  $needCopy = $true
}
elseif ($sharedUsers -le 0 -and $bestLegacyUsers -gt 0) {
  Write-Host "Shared volume has no login accounts; legacy volume has $bestLegacyUsers." -ForegroundColor Yellow
  $needCopy = $true
}

if ($needCopy) {
  if (-not $bestLegacy) {
    Write-Host "No legacy MySQL volume with data found - creating empty shared volume." -ForegroundColor Green
    docker volume create $SharedVolume | Out-Null
  }
  else {
    Copy-DockerVolume -From $bestLegacy -To $SharedVolume
    $sharedUsers = Get-TilegameUserCount $SharedVolume
    Write-Host "Shared volume ready: $sharedUsers login accounts." -ForegroundColor Green
  }
}
else {
  Write-Host "Shared volume OK: $sharedUsers login accounts." -ForegroundColor Green
}

Write-Host ""
Write-Host "All Tilezilla stacks use volume: $SharedVolume on container garz-puzzle-mysql" -ForegroundColor Cyan
Write-Host "Wipe accounts only deliberately: docker volume rm $SharedVolume" -ForegroundColor DarkYellow
