@echo off
wsl.exe --distribution Ubuntu-22.04 --user root --cd "%~dp0." --exec python3 scripts/start_local.py
if errorlevel 1 (
 pause
 exit /b 1
)
start "" "http://127.0.0.1:18083"
