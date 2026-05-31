# ✈️ Detector de vuelos internacionales económicos

Programa que **revisa solo, todos los días**, los precios de vuelos ida y vuelta
desde **Bogotá (BOG)** y **Medellín (MDE)** hacia las principales ciudades del
mundo, y te **avisa por Telegram y/o correo** cuando encuentra una ganga.

Guarda además un historial de precios (`datos/historial.csv`) que puedes abrir
en Excel para ver cómo evolucionan.

---

## 1. Cómo funciona (en una frase)

Para cada ruta y cada mes futuro, consulta el vuelo ida y vuelta más barato en la
API gratuita de **Travelpayouts (Aviasales)**, lo compara con tu **umbral** y con
el **mínimo histórico**, y si es buena oferta te manda un mensaje.

```
config.py         → tus rutas, destinos y umbrales (lo que tú editas)
detector.py       → el cerebro: busca, compara y decide si avisar
travelpayouts.py  → habla con la API de vuelos
notificaciones.py → manda el aviso por Telegram y correo
almacenamiento.py → guarda historial y evita avisos repetidos
```

---

## 2. Instalación (una sola vez)

Necesitas **Python 3.10 o superior**. Comprueba en PowerShell:

```powershell
python --version
```

Si no lo tienes, instálalo desde https://www.python.org/downloads/ (marca la
casilla *"Add Python to PATH"* durante la instalación).

Luego, dentro de la carpeta del proyecto:

```powershell
# 1. Crear un entorno aislado (recomendado)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Instalar las librerías necesarias
pip install -r requirements.txt
```

> Si PowerShell bloquea la activación del entorno, ejecuta una vez:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y vuelve a intentar.

---

## 3. Conseguir las credenciales

### a) Travelpayouts (obligatorio — son los datos de vuelos, gratis)

1. Entra a https://www.travelpayouts.com y crea una cuenta gratuita (con tu
   correo). Confirma el correo de activación.
2. Inicia sesión y ve a la sección de **desarrolladores / API**
   (menú: *Tools / Herramientas → API* o *For developers*).
3. Copia tu **API token**. Ese es tu `TRAVELPAYOUTS_TOKEN`.
4. *(Opcional)* En **Tools → Links / Marker** encontrarás tu **marker**
   (un número). Si lo pones en `TRAVELPAYOUTS_MARKER`, ganarás comisión cuando
   alguien reserve por tus enlaces.

> Los precios de Travelpayouts son datos **en caché** (lo más barato visto
> recientemente), perfectos para detectar gangas. Confirma siempre el precio
> final en el enlace antes de comprar.

### b) Telegram (recomendado — avisos instantáneos)

1. En Telegram, escribe a **@BotFather** y envía `/newbot`. Sigue los pasos y
   te dará un **token** (algo como `123456:ABC-DEF...`).
2. Escríbele cualquier cosa a **tu** bot recién creado (para "activarlo").
3. Para saber tu **chat_id**: escribe a **@userinfobot** y te lo dice.
4. Guarda token y chat_id en el `.env`.

### c) Correo por Gmail (opcional)

1. Activa la **verificación en dos pasos** en tu cuenta de Google.
2. Crea una **contraseña de aplicación**:
   https://myaccount.google.com/apppasswords (son 16 letras).
3. Usa esa contraseña (no la normal) en `EMAIL_PASSWORD`.

### Guardar las credenciales

Copia `.env.example` y renómbralo a `.env`, luego rellena tus datos:

```powershell
Copy-Item .env.example .env
notepad .env
```

---

## 4. Probar localmente

```powershell
python detector.py
```

Verás en pantalla el avance y, si hay gangas, recibirás los avisos.
Revisa `datos/historial.csv` para ver los precios guardados.

> **Consejo:** la primera vez no habrá "mínimo histórico", así que solo saltarán
> alertas por umbral. Mientras más días corra, más inteligente se vuelve.

---

## 5. Personalizar

Todo se ajusta en **`config.py`**:

- **`DESTINOS`**: agrega/quita ciudades y cambia el umbral de cada una.
- **`MESES_A_EXPLORAR`**: cuántos meses hacia adelante buscar.
- **`SOLO_DIRECTOS`**: `True` si solo quieres vuelos sin escalas.
- **`ORIGENES`**: si algún día viajas desde otra ciudad.

> ⚠️ El número total de consultas es orígenes × destinos × meses.
> Con la configuración por defecto son ~224 consultas por corrida, holgado
> dentro del límite gratuito si lo corres una vez al día.

---

## 6. Dejarlo funcionando solo (automático)

### Opción A — GitHub Actions (gratis, recomendado, no necesitas tu PC encendido)

1. Crea un repositorio **privado** en GitHub y sube esta carpeta.
2. En el repo: **Settings → Secrets and variables → Actions → New repository
   secret** y crea uno por cada variable de tu `.env`
   (`TRAVELPAYOUTS_TOKEN`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, etc.).
3. ¡Listo! El archivo `.github/workflows/detector.yml` ya está configurado para
   ejecutarse **todos los días a las 8:00 a.m. (hora Colombia)**. También puedes
   lanzarlo a mano desde la pestaña **Actions → Detector de vuelos → Run**.

> El `.env` NO se sube (está en `.gitignore`). En GitHub las credenciales viven
> como *Secrets*. El historial sí se guarda automáticamente en el repo.

### Opción B — Tu PC con el Programador de tareas de Windows

1. Crea un archivo `ejecutar.bat` con:
   ```bat
   cd /d "%~dp0"
   .venv\Scripts\python.exe detector.py
   ```
2. Abre **Programador de tareas → Crear tarea básica**, elige diario a la hora
   que quieras y apunta al `.bat`. (Tu PC debe estar encendido a esa hora.)

---

## 7. Notas importantes

- **No existe API oficial gratuita de Google Flights.** Usamos Travelpayouts,
  que es gratis y legal. Siempre **verifica el precio final** en el enlace antes
  de comprar: las alertas son una guía, no una reserva.
- *(Nota: antes este proyecto usaba Amadeus, pero su portal de autoservicio
  gratuito cierra el 17 de julio de 2026, por eso migramos a Travelpayouts.)*
- Si quieres, más adelante podemos añadir un **panel web con gráficas** del
  historial de precios.

¡Buen viaje! 🌍
