# -*- coding: utf-8 -*-
"""Cliente de la API gratuita de Travelpayouts (Aviasales) para precios de vuelos.

Usa DOS endpoints para maximizar cobertura:
  1. prices_for_dates — el vuelo más barato de un mes (cache 48h)
  2. prices_latest   — los precios más recientes detectados (cache 48h)

La estrategia "mejor de ambos" reduce el riesgo de mostrar un precio
obsoleto o de perderse una oferta que solo apareció en un endpoint.

Cambios clave vs versión anterior:
  - NO forzamos return_at = mismo mes → encuentra viajes que salen a fin de
    mes y vuelven el siguiente (antes invisibles)
  - limit=30 en prices_for_dates → más candidatos por consulta
  - prices_latest como fuente secundaria (1 llamada por ruta, no por mes)
"""
import os

import requests

BASE = "https://api.travelpayouts.com/aviasales/v3"
URL_DATES = f"{BASE}/prices_for_dates"
URL_LATEST = f"{BASE}/prices_latest"


def _token():
    return os.environ["TRAVELPAYOUTS_TOKEN"]


def _int_o_none(v):
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _link_aviasales(raw_link):
    if not raw_link:
        return ""
    link = "https://www.aviasales.com" + raw_link
    marker = os.environ.get("TRAVELPAYOUTS_MARKER", "")
    if marker:
        sep = "&" if "?" in link else "?"
        link = f"{link}{sep}marker={marker}"
    return link


def _normalizar(fila, moneda):
    """Convierte una fila cruda de la API a nuestro formato estándar."""
    try:
        precio = float(fila.get("price"))
    except (TypeError, ValueError):
        return None
    if precio <= 0:
        return None
    return {
        "precio": precio,
        "moneda": moneda.upper(),
        "aerolinea": fila.get("airline") or "—",
        "fecha_ida": (fila.get("departure_at") or "")[:10],
        "fecha_vuelta": (fila.get("return_at") or "")[:10],
        "link": _link_aviasales(fila.get("link", "")),
        "escalas_ida": _int_o_none(fila.get("transfers")),
        "escalas_vuelta": _int_o_none(fila.get("return_transfers")),
    }


def buscar_precios_dates(origen, destino, mes, moneda, solo_directos):
    """Endpoint prices_for_dates: vuelos más baratos de un mes.
    NO forzamos return_at → encuentra viajes cross-mes."""
    params = {
        "origin": origen,
        "destination": destino,
        "departure_at": mes,
        "currency": moneda.lower(),
        "sorting": "price",
        "one_way": "false",
        "limit": 30,
        "token": _token(),
    }
    if solo_directos:
        params["direct"] = "true"

    resp = requests.get(URL_DATES, params=params, timeout=60)
    resp.raise_for_status()
    resultados = []
    for fila in resp.json().get("data", []):
        r = _normalizar(fila, moneda)
        if r:
            resultados.append(r)
    return resultados


def buscar_precios_latest(origen, destino, moneda, solo_directos):
    """Endpoint prices_latest: precios más recientes detectados para la ruta.
    Llama UNA VEZ por (origen, destino) — el detector cachea el resultado
    y filtra por mes localmente."""
    params = {
        "origin": origen,
        "destination": destino,
        "currency": moneda.lower(),
        "sorting": "price",
        "one_way": "false",
        "limit": 30,
        "token": _token(),
    }
    if solo_directos:
        params["direct"] = "true"

    try:
        resp = requests.get(URL_LATEST, params=params, timeout=60)
        resp.raise_for_status()
    except Exception:
        return []

    resultados = []
    for fila in resp.json().get("data", []):
        r = _normalizar(fila, moneda)
        if r:
            resultados.append(r)
    return resultados


def buscar_oferta_mas_barata(origen, destino, mes, moneda, solo_directos,
                             cache_latest=None):
    """Consulta prices_for_dates + opcionalmente prices_latest (pre-cacheado)
    y devuelve la oferta más barata del mes. Retorna None si no hay resultados.

    cache_latest: lista de resultados de buscar_precios_latest() ya obtenida
    para esta ruta. Si no se pasa, NO llama al segundo endpoint (el detector
    lo cachea por ruta para evitar llamadas redundantes por mes).
    """
    todas = buscar_precios_dates(origen, destino, mes, moneda, solo_directos)

    if cache_latest:
        for r in cache_latest:
            if r["fecha_ida"][:7] == mes:
                todas.append(r)

    if not todas:
        return None

    return min(todas, key=lambda r: r["precio"])
