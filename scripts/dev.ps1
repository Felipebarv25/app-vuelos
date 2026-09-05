# Levanta o compila Anduve sin que OneDrive toque .next.
#
# EL PROBLEMA
#
# El repositorio vive dentro de OneDrive. Next escribe miles de ficheros en
# .next mientras compila, OneDrive intenta sincronizarlos a medio escribir y
# los bloquea: el build se queda colgado sin decir por que. Por eso las
# compilaciones se venian haciendo a mano en una copia del proyecto.
#
# LA SOLUCION
#
# No mover el proyecto: mover solo la SALIDA. next.config.mjs lee
# ANDUVE_DIST_DIR y, si esta puesta, escribe ahi en vez de en .next. Este
# script la pone apuntando a %LOCALAPPDATA%, que OneDrive no sincroniza.
#
# Sin la variable todo sigue igual (.next), asi que Vercel no se entera: alli
# no existe ni OneDrive ni la variable.
#
# EL ENLACE A node_modules
#
# Next resuelve modulos caminando hacia arriba desde la carpeta de salida, y
# %LOCALAPPDATA%\anduve-build no tiene node_modules encima: el build compila
# pero revienta al prerenderizar con "Cannot find module 'react/jsx-runtime'".
# Se arregla con una union (junction) de node_modules dentro de esa carpeta.
# No copia nada: es un puntero al node_modules de verdad.
#
# USO
#
#   .\scripts\dev.ps1              servidor de desarrollo en :3000
#   .\scripts\dev.ps1 -Puerto 3005
#   .\scripts\dev.ps1 -Modo build  compila para produccion
#   .\scripts\dev.ps1 -Modo start  compila y sirve el resultado real
#   .\scripts\dev.ps1 -Limpiar     borra la salida y empieza de cero

param(
  [ValidateSet("dev", "build", "start")]
  [string]$Modo = "dev",
  [int]$Puerto = 3000,
  [switch]$Limpiar
)

$ErrorActionPreference = "Stop"

# Raiz del repositorio y carpeta de la app, calculadas desde este script para
# que funcione desde cualquier directorio.
$raiz = Split-Path -Parent $PSScriptRoot
$web  = Join-Path $raiz "web"
if (-not (Test-Path (Join-Path $web "package.json"))) {
  Write-Error "No encuentro web\package.json. ¿Movieron el proyecto?"
}

$salida = Join-Path $env:LOCALAPPDATA "anduve-build"
$dist   = Join-Path $salida "next"

if ($Limpiar -and (Test-Path $dist)) {
  Write-Host "Borrando salida anterior..." -ForegroundColor DarkGray
  Remove-Item -Recurse -Force $dist
}

New-Item -ItemType Directory -Force -Path $salida | Out-Null

# La union a node_modules. Se rehace si apunta a otro sitio (por ejemplo, si
# se movio el proyecto de carpeta).
$enlace = Join-Path $salida "node_modules"
$reales = Join-Path $web "node_modules"
if (-not (Test-Path $reales)) {
  Write-Error "Falta web\node_modules. Corre 'npm install' dentro de web primero."
}
$rehacer = $true
if (Test-Path $enlace) {
  $destinoActual = (Get-Item $enlace).Target
  if ($destinoActual -and ($destinoActual -eq $reales)) { $rehacer = $false }
  else { Remove-Item -Force $enlace }
}
if ($rehacer) {
  Write-Host "Enlazando node_modules (no copia, es un puntero)..." -ForegroundColor DarkGray
  cmd /c mklink /J "`"$enlace`"" "`"$reales`"" | Out-Null
}

# distDir tiene que ser RELATIVO a web\: Next lo une a la raiz del proyecto y
# una ruta absoluta acaba como "web\C:\Users\...". Se calcula sobre la marcha
# para que siga funcionando si cambia el usuario o la ruta del repositorio.
Push-Location $web
try {
  # [System.IO.Path]::GetRelativePath NO existe en Windows PowerShell 5.1 (es
  # de .NET Core). Se calcula con URIs, que si esta en 5.1 y ademas no exige
  # que la carpeta destino exista todavia.
  $uWeb  = New-Object System.Uri(($web.TrimEnd('\') + '\'))
  $uDist = New-Object System.Uri($dist)
  $rel   = [System.Uri]::UnescapeDataString($uWeb.MakeRelativeUri($uDist).ToString())
  $env:ANDUVE_DIST_DIR = $rel

  # A partir de aqui manda Next, y sus AVISOS salen por stderr.
  # Windows PowerShell 5.1 envuelve cada linea de stderr de un ejecutable
  # nativo en un ErrorRecord, y con ErrorActionPreference="Stop" un simple
  # "Using edge runtime..." aborta el script como si el build hubiera
  # fallado. El exito o fracaso real se mira con $LASTEXITCODE.
  $ErrorActionPreference = "Continue"

  Write-Host ""
  Write-Host "  proyecto : $web"          -ForegroundColor DarkGray
  Write-Host "  salida   : $dist"         -ForegroundColor DarkGray
  Write-Host "  distDir  : $rel"          -ForegroundColor DarkGray
  Write-Host "  OneDrive no toca nada de la compilacion." -ForegroundColor DarkGreen
  Write-Host ""

  switch ($Modo) {
    "dev" {
      Write-Host "Servidor de desarrollo en http://localhost:$Puerto" -ForegroundColor Cyan
      npx next dev -p $Puerto
    }
    "build" {
      npx next build
    }
    "start" {
      npx next build
      if ($LASTEXITCODE -ne 0) { Write-Error "El build fallo; no se levanta el servidor." }
      Write-Host "Sirviendo el build en http://localhost:$Puerto" -ForegroundColor Cyan
      npx next start -p $Puerto
    }
  }
}
finally {
  Pop-Location
  Remove-Item Env:\ANDUVE_DIST_DIR -ErrorAction SilentlyContinue
}
