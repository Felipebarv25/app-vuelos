# -*- coding: utf-8 -*-
"""
Configuración del detector de vuelos.

Edita SOLO este archivo para personalizar orígenes, destinos y umbrales.
Las credenciales (token, correo) NUNCA van aquí: van en el archivo .env
"""

# Aeropuertos / ciudades de salida (códigos IATA de ciudad o aeropuerto)
ORIGENES = ["BOG", "MDE"]  # Bogotá, Medellín

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

# Cuántos meses hacia adelante explorar (busca el vuelo más barato de cada mes)
MESES_A_EXPLORAR = 8

# ¿Solo vuelos directos? (False = permite escalas; recomendado para mejor precio)
SOLO_DIRECTOS = False

# Avisar también cuando el precio sea el más bajo jamás registrado para la ruta
AVISAR_NUEVO_MINIMO = True

# Segundos de espera entre llamadas a la API (para no exceder los límites)
ESPERA_ENTRE_LLAMADAS = 0.3
