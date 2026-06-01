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
