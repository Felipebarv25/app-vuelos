@echo off
REM Lanzador del detector de vuelos para el Programador de tareas de Windows.
REM Se situa en su propia carpeta y ejecuta el detector con el Python del entorno.
cd /d "%~dp0"
".venv\Scripts\python.exe" detector.py >> "datos\registro.log" 2>&1
