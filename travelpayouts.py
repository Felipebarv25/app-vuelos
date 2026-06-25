# -*- coding: utf-8 -*-
"""Cliente de la API gratuita de Travelpayouts (Aviasales) para precios de vuelos.

Documentación: https://support.travelpayouts.com/hc/en-us/articles/203956163
Endpoint usado: "Prices for dates" (devuelve el vuelo más barato de un periodo).
"""
import os

import requests

BASE_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"


def buscar_oferta_mas_barata(origen, destino, mes, moneda, solo_directos):
    """Devuelve la oferta ida y vuelta más barata para un mes (formato 'YYYY-MM'),
    o None si no hay resultados."""
    params = {
        "origin": origen,
        "destination": destino,
        "departure_at": mes,        # busca cualquier día de ese mes
        "return_at": mes,           # regreso dentro del mismo mes
        "currency": moneda.lower(),
        "sorting": "price",
        "one_way": "false",         # ida y vuelta
        "limit": 1,                 # solo la más barata
        "token": os.environ["TRAVELPAYOUTS_TOKEN"],
    }
    if solo_directos:
        params["direct"] = "true"

    resp = requests.get(BASE_URL, params=params, timeout=60)
    resp.raise_for_status()
    datos = resp.json().get("data", [])
    if not datos:
        return None

    # La API a veces devuelve filas con precio nulo/cero para rutas sin datos
    # reales. Nos quedamos solo con las que traen un precio válido (> 0).
    validas = []
    for fila in datos:
        try:
            p = float(fila.get("price"))
        except (TypeError, ValueError):
            continue
        if p > 0:
            validas.append((p, fila))
    if not validas:
        return None

    precio, mejor = min(validas, key=lambda x: x[0])

    # Construir el enlace para reservar (con tu marker de afiliado si lo tienes)
    link = "https://www.aviasales.com" + mejor.get("link", "")
    marker = os.environ.get("TRAVELPAYOUTS_MARKER", "")
    if marker:
        sep = "&" if "?" in link else "?"
        link = f"{link}{sep}marker={marker}"

    # Escalas: la API devuelve `transfers` (ida) y `return_transfers` (vuelta).
    # 0 = vuelo directo. Si el campo viene ausente (raro), guardamos None y la
    # UI lo trata como "desconocido" en lugar de mentir mostrando "directo".
    def _int_o_none(v):
        try:
            return int(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    return {
        "precio": precio,
        "moneda": moneda.upper(),
        "aerolinea": mejor.get("airline") or "—",
        "fecha_ida": (mejor.get("departure_at") or mes)[:10],
        "fecha_vuelta": (mejor.get("return_at") or "")[:10],
        "link": link,
        "escalas_ida": _int_o_none(mejor.get("transfers")),
        "escalas_vuelta": _int_o_none(mejor.get("return_transfers")),
    }
