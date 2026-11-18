@echo off
rem ============================================================
rem  Abrams model evolution - local preview
rem  Double-click: start a static server and open the browser.
rem  Close this window or press Ctrl+C to stop.
rem  Optional:  start.bat --no-browser
rem ============================================================
cd /d "%~dp0"

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY (
  where py >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
  echo.
  echo   [x] Python 3 was not found.
  echo       Install it from https://www.python.org/downloads/
  echo       and tick "Add python.exe to PATH" during setup.
  echo.
  pause
  exit /b 1
)

%PY% serve.py %*
if errorlevel 1 (
  echo.
  echo   [x] Server exited with an error. See the message above.
  echo.
  pause
)
