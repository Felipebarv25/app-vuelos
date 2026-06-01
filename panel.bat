@echo off
REM Abre el panel web de vuelos en tu navegador.
REM Levanta un servidor local (necesario para que el panel lea el historial)
REM y abre la pagina automaticamente.
cd /d "%~dp0"
start "" http://localhost:8000/index.html
".venv\Scripts\python.exe" -m http.server 8000
