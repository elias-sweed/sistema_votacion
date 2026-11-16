@echo off
REM Abre el kiosco de votación en Chrome o Edge.
REM Uso: kiosco-windows.cmd "https://tu-dominio/votar/TOKEN"
if "%~1"=="" (
  echo Falta la URL del kiosco.
  echo Uso: kiosco-windows.cmd "https://tu-dominio/votar/TOKEN"
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kiosco-windows.ps1" -Url "%~1"
