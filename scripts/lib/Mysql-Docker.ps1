# Shared MySQL Docker helpers for import scripts.

function Test-MySqlAppLogin {
  param([string]$RepoRoot)

  $check = @'
import os, sys
try:
    import pymysql
except ImportError:
    sys.exit(2)
try:
    pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "mysql"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "tilegame"),
        password=os.environ.get("MYSQL_PASSWORD", "tilegame_dev"),
        database=os.environ.get("MYSQL_DATABASE", "tilegame"),
        connect_timeout=5,
    ).close()
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
'@

  Push-Location $RepoRoot
  try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose run --rm `
      -e MYSQL_HOST=mysql `
      -e MYSQL_PORT=3306 `
      -e MYSQL_USER=tilegame `
      -e MYSQL_PASSWORD=tilegame_dev `
      -e MYSQL_DATABASE=tilegame `
      web sh -c "pip install -q pymysql && python -c '$check'" 2>$null | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return ($code -eq 0)
  }
  finally {
    Pop-Location
  }
}

function Ensure-MySqlTilegameReady {
  param([string]$RepoRoot)

  $mysqlState = docker compose ps mysql --format "{{.State}}" 2>$null
  if ($mysqlState -ne "running") {
    throw "MySQL is not running. Start it with: docker compose up -d mysql"
  }

  if (Test-MySqlAppLogin -RepoRoot $RepoRoot) {
    return
  }

  Write-Host ""
  Write-Host "MySQL not ready for web-container import (missing tilegame DB/user or host grant)." -ForegroundColor Yellow
  Write-Host "Running bootstrap-mysql-tilegame.ps1 …" -ForegroundColor Yellow
  & (Join-Path $RepoRoot "scripts\bootstrap-mysql-tilegame.ps1")
  if ($LASTEXITCODE -ne 0) {
    throw "MySQL bootstrap failed"
  }
  if (-not (Test-MySqlAppLogin -RepoRoot $RepoRoot)) {
    throw "MySQL still not reachable from web container after bootstrap"
  }
}
