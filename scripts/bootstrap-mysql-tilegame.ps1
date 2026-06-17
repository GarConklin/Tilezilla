<#
.SYNOPSIS
  Create tilegame database + user (localhost + docker network) and apply init SQL.

.DESCRIPTION
  Repairs a MySQL volume that is running but missing tilegame schema/users
  (e.g. init scripts never ran). Uses root socket login inside the mysql container.

.EXAMPLE
  .\scripts\bootstrap-mysql-tilegame.ps1

.EXAMPLE
  .\scripts\bootstrap-mysql-tilegame.ps1 -DryRun
#>
param(
  [string]$RepoRoot = "",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

Push-Location $RepoRoot
try {
  $mysqlRunning = docker compose ps mysql --format "{{.State}}" 2>$null
  if ($mysqlRunning -ne "running") {
    throw "MySQL is not running. Start with: docker compose up -d mysql"
  }

  $db = docker compose exec -T mysql printenv MYSQL_DATABASE 2>$null
  $user = docker compose exec -T mysql printenv MYSQL_USER 2>$null
  $pass = docker compose exec -T mysql printenv MYSQL_PASSWORD 2>$null
  if (-not $db) { $db = "tilegame" }
  if (-not $user) { $user = "tilegame" }
  if (-not $pass) { $pass = "tilegame_dev" }

  $escPass = $pass.Replace("'", "''")
  $setupSql = @"
CREATE DATABASE IF NOT EXISTS ``$db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$user'@'%' IDENTIFIED BY '$escPass';
CREATE USER IF NOT EXISTS '$user'@'localhost' IDENTIFIED BY '$escPass';
GRANT ALL PRIVILEGES ON ``$db``.* TO '$user'@'%';
GRANT ALL PRIVILEGES ON ``$db``.* TO '$user'@'localhost';
FLUSH PRIVILEGES;
"@

  Write-Step "Create database and user ($user@%, $user@localhost)"
  if ($DryRun) {
    Write-Host $setupSql
  }
  else {
    $setupSql | docker compose exec -T mysql mysql -uroot
    if ($LASTEXITCODE -ne 0) { throw "Database/user setup failed" }
  }

  $initDir = Join-Path $RepoRoot "docker\mysql\init"
  $initFiles = Get-ChildItem -Path $initDir -Filter "*.sql" | Sort-Object Name
  foreach ($file in $initFiles) {
    Write-Step "Apply $($file.Name)"
    if ($DryRun) { continue }
    Get-Content -LiteralPath $file.FullName -Raw | docker compose exec -T mysql mysql -uroot
    if ($LASTEXITCODE -ne 0) { throw "Failed applying $($file.Name)" }
  }

  if (-not $DryRun) {
    Write-Step "Verify"
    docker compose exec -T mysql mysql -uroot -e "SHOW DATABASES LIKE '$db'; SELECT user, host FROM mysql.user WHERE user='$user';"
  }

  Write-Host ""
  Write-Host "MySQL tilegame bootstrap complete." -ForegroundColor Green
}
finally {
  Pop-Location
}
