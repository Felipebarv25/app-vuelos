# -*- coding: utf-8 -*-
"""
Configuración del detector de vuelos.

Edita SOLO este archivo para personalizar orígenes, destinos y umbrales.
Las credenciales (token, correo) NUNCA van aquí: van en el archivo .env
"""

# Aeropuertos / ciudades de salida (códigos IATA de ciudad o aeropuerto).
# Multi-país: hub principal de cada uno de los 10 países soportados en la web.
# Si la cuota de Travelpayouts se queda corta, lo más sano es:
#   1) Reducir MESES_A_EXPLORAR (de 6 → 4-5)
#   2) Reducir frecuencia del cron en .github/workflows/detector.yml (de 3h a 6h)
#   3) Quitar hubs que no aporten tráfico (mira el panel de visitas por país)
ORIGENES = [
    # Colombia (mercado principal): los 4 hubs que declara PAISES_ORIGEN en la
    # web. Antes solo se escaneaban BOG y MDE, asi que el selector de origenes
    # del banner "Vuelos mas baratos" mostraba chips vacios para Cali y
    # Cartagena. CLO y CTG tienen pocas rutas de largo radio directas, pero si
    # aparecen como opcion tienen que traer datos.
    "BOG", "MDE", "CLO", "CTG",
    "MEX",          # México
    "UIO",          # Ecuador
    "LIM",          # Perú
    "SCL",          # Chile
    "EZE",          # Argentina
    "GRU",          # Brasil
    "CCS",          # Venezuela
    "MAD",          # España
    "MIA",          # Estados Unidos (gateway Latam)
]

# Moneda en la que pedimos y comparamos los precios
MONEDA = "USD"

# Destinos: código IATA -> (nombre legible, umbral de "ganga" ida y vuelta)
# Si el precio ida+vuelta baja de ese umbral (en USD), se considera oferta.
# Ajusta los umbrales a tu gusto: más bajos = alertas solo ante gangas reales.
DESTINOS = {
    # --- Europa ---
    "MAD": ("Madrid", 750),
    "BCN": ("Barcelona", 750),
    "ROM": ("Roma", 800),
    "MIL": ("Milán", 800),
    "PAR": ("París", 800),
    "LON": ("Londres", 800),
    # --- Asia ---
    "TYO": ("Tokio", 1300),
    "BJS": ("Beijing", 1700),
    # --- Norteamérica ---
    "MIA": ("Miami (EE. UU.)", 400),
    "NYC": ("Nueva York (EE. UU.)", 450),
    "MEX": ("Ciudad de México", 400),
    # --- Sudamérica ---
    "SAO": ("São Paulo (Brasil)", 450),
    "BUE": ("Buenos Aires (Argentina)", 450),
    "LIM": ("Lima (Perú)", 300),
}

# Cuántos meses hacia adelante explorar (busca el vuelo más barato de cada mes).
# Bajado de 8 → 6 al pasar de 2 a 11 origenes (multi-pais Fase 2) para mantener
# el costo de API: 13 origenes × 14 destinos × 6 meses = 1,092 llamadas por
# corrida. El workflow pide una corrida por hora, pero GitHub descarta buena
# parte: la cadencia real medida el 2026-07-26 fue ~9 corridas/dia, o sea
# ~9,800 llamadas/dia de "dates" mas ~2,200/dia del escaneo de directos.
MESES_A_EXPLORAR = 6

# ¿Solo vuelos directos? (False = permite escalas; recomendado para mejor precio)
SOLO_DIRECTOS = False

# --- Escaneo aparte de vuelos SIN ESCALAS ---
# El vuelo mas barato de un mes casi nunca es directo (suele ser una conexion),
# asi que la consulta normal jamas registra los directos y el filtro "Solo
# directos" de la web se queda sin datos. Para arreglarlo, en las horas de abajo
# se hace una consulta extra con direct=true por ruta+mes y se guarda tambien el
# directo mas barato.
#
# Costo: cada pasada suma 13 origenes × 14 destinos × 6 meses = 1,092 llamadas.
# Con ~2 pasadas al dia son ~2,200/dia extra. Como DIAS_FRESCOS_RESUMEN es 3,
# dos pasadas diarias sobran: los directos son pocos y su precio se mueve lento.
ESCANEO_DIRECTOS = True

# Horas minimas entre pasadas de directos.
#
# OJO: antes esto eran horas UTC fijas (7 y 19) y NO funcionaba. El workflow dice
# `cron: "0 * * * *"` pero GitHub descarta corridas programadas en repos
# publicos: la cadencia real observada el 2026-07-26 fue 00, 03, 06, 09, 11, 13,
# 15, 16, 17 UTC — ~9 corridas, y ninguna en la hora 7. La condicion
# `hour in (7, 19)` nunca se cumplia y el escaneo jamas corrio.
#
# Con tiempo transcurrido en vez de horas fijas da igual cuando caiga la corrida,
# y si se salta una, la siguiente lo recupera. 11 horas ≈ 2 pasadas/dia dejando
# margen para que una corrida saltada no empuje la siguiente al dia siguiente.
HORAS_ENTRE_ESCANEOS_DIRECTOS = 11

# --- Detección INTELIGENTE de gangas ("solo precios fuera de lo normal") ---
# Estos ajustes evitan "avisar por avisar": solo alertan cuando el precio es
# realmente excepcional comparado con lo que suele costar esa misma ruta y mes.

# Mínimo de observaciones previas (de la misma ruta y mes de salida) que se
# necesitan para confiar en la estadística. Antes de eso, modo conservador.
MIN_MUESTRAS_HISTORIAL = 5

# Qué tan por debajo de lo "habitual" debe estar para considerarse ganga.
# 0.15 = al menos 15% más barato que el precio típico de esa ruta+mes.
DESCUENTO_MINIMO = 0.15

# Un precio dentro del X% más barato jamás visto para esa ruta+mes se considera
# ganga (20 = pertenece al 20% de precios más bajos del histórico).
PERCENTIL_GANGA = 20

# Segundos de espera entre llamadas a la API (para no exceder los límites)
ESPERA_ENTRE_LLAMADAS = 0.3
