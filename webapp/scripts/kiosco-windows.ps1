# Abre Chrome o Edge en modo kiosco para una mesa de votación.
#
# Ejemplo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\kiosco-windows.ps1 `
#     -Url "https://tu-dominio/votar/TOKEN"
#
# Usa -Navegador Edge para forzar Edge y -SinPerfil para el perfil normal.

param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [ValidateSet('Chrome', 'Edge')]
  [string]$Navegador = 'Chrome',

  [string]$Perfil = "$env:LOCALAPPDATA\SistemaVotacion\kiosco",

  [switch]$SinPerfil
)

$ErrorActionPreference = 'Stop'

try {
  $uri = [System.Uri]$Url
} catch {
  throw "URL inválida: $Url"
}

if ($uri.Scheme -ne 'https' -and $uri.Host -notin @('localhost', '127.0.0.1')) {
  throw "Por seguridad usa HTTPS (o localhost durante pruebas). URL recibida: $Url"
}

$candidatosChrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$candidatosEdge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)

function Buscar-Navegador([string]$nombre) {
  switch ($nombre) {
    'Chrome' { return $candidatosChrome | Where-Object { Test-Path $_ } | Select-Object -First 1 }
    'Edge' { return $candidatosEdge | Where-Object { Test-Path $_ } | Select-Object -First 1 }
  }
  return $null
}

$exe = $null
if ($Navegador -eq 'Chrome') {
  $exe = Buscar-Navegador 'Chrome'
  if (-not $exe) {
    Write-Warning 'No se encontró Chrome. Se intentará con Edge.'
    $exe = Buscar-Navegador 'Edge'
  }
} else {
  $exe = Buscar-Navegador 'Edge'
  if (-not $exe) {
    Write-Warning 'No se encontró Edge. Se intentará con Chrome.'
    $exe = Buscar-Navegador 'Chrome'
  }
}

if (-not $exe) {
  throw 'No se encontró Chrome ni Edge. Instala uno de los dos navegadores.'
}

$argumentos = @(
  '--kiosk',
  '--no-first-run',
  '--disable-pinch',
  '--overscroll-history-navigation=0'
)

if (-not $SinPerfil) {
  New-Item -ItemType Directory -Force -Path $Perfil | Out-Null
  $argumentos += "--user-data-dir=$Perfil"
}

$argumentos += $uri.AbsoluteUri

Write-Host "Abriendo kiosco con $([System.IO.Path]::GetFileNameWithoutExtension($exe))…"
Write-Host "URL: $($uri.AbsoluteUri)"
Write-Host 'Para salir del modo kiosco: Alt + F4.'

Start-Process -FilePath $exe -ArgumentList $argumentos
