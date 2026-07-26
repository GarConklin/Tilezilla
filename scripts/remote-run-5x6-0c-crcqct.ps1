# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\remote-run-5x6-0c-crcqct.ps1
& "$PSScriptRoot\..\tools\scripts\remote-run-5x6-0c-crcqct.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
