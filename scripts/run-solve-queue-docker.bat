@echo off
setlocal enabledelayedexpansion

REM Run queued solves sequentially via Docker (one at a time).
REM Usage:
REM   scripts\run-solve-queue-docker.bat
REM
REM Notes:
REM - Stops immediately on first error (non-zero exit code).
REM - Uses stderr progress every N seeds (see FLAGS --progress-every).

set "BASE_CMD=docker compose run --rm web node solves/solve-level.js"
set "FLAGS=--viable-seeds-only --write-solves --json-summary --progress-every 1 --progress-on-json"

rem call :run_level 5x6-0B-AAA
rem call :run_level 5x6-0B-AAG
rem call :run_level 5x6-0B-AAH
rem call :run_level 5x6-0B-AAI
rem call :run_level 5x6-0B-AAJ
rem call :run_level 5x6-0B-AAK
rem call :run_level 5x6-0B-AAL
rem call :run_level 5x6-0B-AAM
rem call :run_level 5x6-0B-AAN
call :run_level 5x6-0B-AAO
call :run_level 5x6-0B-AAP
call :run_level 5x6-0B-AAQ
call :run_level 5x6-0B-AAR
call :run_level 5x6-0B-AAS
call :run_level 5x6-0B-AAT
call :run_level 5x6-0B-AAU
call :run_level 5x6-0B-AAV
call :run_level 5x6-0B-AAW
call :run_level 5x6-0B-AAX
call :run_level 5x6-0B-AAY
call :run_level 5x6-0B-AAZ
call :run_level 5x6-0B-ABA
call :run_level 5x6-0B-ABB
call :run_level 5x6-0B-ABC
call :run_level 5x6-0B-ABD
call :run_level 5x6-0B-ABE
call :run_level 5x6-0B-ABF
call :run_level 5x6-0B-ABG
call :run_level 5x6-0B-ABH
call :run_level 5x6-0B-ABI
call :run_level 5x6-0B-ABJ
call :run_level 5x6-0B-ABK
call :run_level 5x6-0B-ABL
call :run_level 5x6-0B-ABM
call :run_level 5x6-0B-ABN
call :run_level 5x6-0B-ABO
call :run_level 5x6-0B-ABP
call :run_level 5x6-0B-ABQ
call :run_level 5x6-0B-ABR
call :run_level 6x6-0A-AAA
call :run_level 5x6-0C-AAA
echo.
echo All queued levels finished successfully.
exit /b 0

:run_level
set "LEVEL_ID=%~1"
echo.
echo ==================================================
echo Running !LEVEL_ID!
echo Command: %BASE_CMD% !LEVEL_ID! %FLAGS%
echo ==================================================
%BASE_CMD% !LEVEL_ID! %FLAGS%
if errorlevel 1 (
  echo.
  echo ERROR: Solve failed for !LEVEL_ID! with exit code !errorlevel!.
  echo Fix the issue, then rerun this batch file to continue.
  exit /b !errorlevel!
)
echo Completed !LEVEL_ID!
exit /b 0

