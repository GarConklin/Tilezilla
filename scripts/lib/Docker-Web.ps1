# Shared helper: run repo scripts inside the web Docker service (repo mounted at /app).

function Invoke-DockerWeb {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$ScriptRel,

    [string[]]$ExtraArgs = @(),

    [System.IO.StreamWriter]$LogWriter = $null
  )

  $scriptInContainer = ($ScriptRel -replace '\\', '/')
  if (-not $scriptInContainer.StartsWith('scripts/')) {
    $scriptInContainer = "scripts/$scriptInContainer"
  }

  $dockerArgs = @('compose', 'run', '--rm', 'web', 'node', $scriptInContainer) + $ExtraArgs
  $cmdLine = "docker $($dockerArgs -join ' ')"
  Write-Host $cmdLine
  if ($LogWriter) {
    $LogWriter.WriteLine($cmdLine)
    $LogWriter.Flush()
  }

  Push-Location $RepoRoot
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker @dockerArgs 2>&1 | ForEach-Object {
      $line = "$_"
      Write-Host $line
      if ($LogWriter) {
        $LogWriter.WriteLine($line)
        $LogWriter.Flush()
      }
    }
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) {
      throw "Docker command failed (exit $LASTEXITCODE): $scriptInContainer"
    }
  }
  finally {
    Pop-Location
  }
}

function Test-DockerCompose {
  param([string]$RepoRoot)
  Push-Location $RepoRoot
  try {
    & docker compose version 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
  }
  finally {
    Pop-Location
  }
}
