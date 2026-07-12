# Forward to tools/scripts/ (Phase 2). Prefer: .\tools\scripts\import-catalog-to-mysql.ps1
& "$PSScriptRoot\..\tools\scripts\import-catalog-to-mysql.ps1" @args
if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
