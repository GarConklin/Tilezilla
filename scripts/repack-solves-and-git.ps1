# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\repack-solves-and-git.ps1
& "$PSScriptRoot\..\tools\scripts\repack-solves-and-git.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
