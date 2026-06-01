# -*- coding: utf-8 -*-
"""Genera web/public/ofertas.json a partir del historial de precios.

Toma el historial completo (datos/historial.csv) y, para cada ruta
origen→destino, calcula la MEJOR oferta vigente (vuelo más barato con fecha de
ida futura), junto con la mediana histórica y el % de descuento, para que la
web muestre un tablero de "vuelos baratos desde Bogotá y Medellín".

Se ejecuta tras el detector (en GitHub Actions) y también se puede correr a mano:
    python generar_ofertas.py
"""
import csv
import json
import os
import statistics
import urllib.parse
from datetime import date, datetime

import config

RAIZ = os.path.dirname(__file__)
HISTORIAL = os.path.join(RAIZ, "datos", "historial.csv")
SALIDA = os.path.join(RAIZ, "web", "public", "ofertas.json")

ORIGENES = {"BOG": "Bogotá", "MDE": "Medellín"}

# Metadatos por destino: nombre limpio, país, bandera y término de búsqueda
# que usa la web para planear el itinerario ("Ciudad, País").
META = {
    "MAD": ("Madrid", "España", "🇪🇸"),
    "BCN": ("Barcelona", "España", "🇪🇸"),
    "ROM": ("Roma", "Italia", "🇮🇹"),
    "MIL": ("Milán", "Italia", "🇮🇹"),
    "PAR": ("París", "Francia", "🇫🇷"),
    "LON": ("Londres", "Reino Unido", "🇬🇧"),
    "TYO": ("Tokio", "Japón", "🇯🇵"),
    "BJS": ("Pekín", "China", "🇨🇳"),
    "MIA": ("Miami", "Estados Unidos", "🇺🇸"),
    "NYC": ("Nueva York", "Estados Unidos", "🇺🇸"),
    "MEX": ("Ciudad de México", "México", "🇲🇽"),
    "SAO": ("São Paulo", "Brasil", "🇧🇷"),
    "BUE": ("Buenos Aires", "Argentina", "🇦🇷"),
    "LIM": ("Lima", "Perú", "🇵🇪"),
}

DESCUENTO_GANGA = 0.15  # 15% bajo la mediana = oferta destacada


def link_vuelos(origen, ciudad, fecha_ida, fecha_vuelta):
    q = f"vuelos desde {origen} a {ciudad} {fecha_ida} {fecha_vuelta}"
    return "https://www.google.com/travel/flights?q=" + urllib.parse.quote(q)


def main():
    if not os.path.exists(HISTORIAL):
        print("No hay historial todavía.")
        return

    hoy = date.today().isoformat()
    # Agrupar filas por (origen, destino), solo con fecha de ida futura.
    rutas = {}
    with open(HISTORIAL, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                precio = float(fila["precio"])
            except (TypeError, ValueError, KeyError):
                continue
            if precio <= 0:
                continue
            ida = fila.get("fecha_ida") or ""
            if ida < hoy:  # ya pasó: no es una oferta vigente
                continue
            clave = (fila["origen"], fila["destino"])
            rutas.setdefault(clave, []).append({**fila, "precio": precio})

    salida = []
    for (origen, destino), filas in rutas.items():
        if origen not in ORIGENES or destino not in META:
            continue
        precios = [r["precio"] for r in filas]
        mejor = min(filas, key=lambda r: r["precio"])
        mediana = statistics.median(precios)
        precio = mejor["precio"]
        descuento = round((1 - precio / mediana) * 100) if mediana else 0
        umbral = config.DESTINOS.get(destino, ("", 0))[1]
        es_ganga = precio <= umbral or (mediana and precio <= mediana * (1 - DESCUENTO_GANGA))
        ciudad, pais, bandera = META[destino]

        salida.append({
            "origen": origen,
            "destino": destino,
            "ciudad": ciudad,
            "pais": pais,
            "bandera": bandera,
            "q": f"{ciudad}, {pais}",
            "precio": round(precio),
            "moneda": mejor.get("moneda", "USD"),
            "fecha_ida": mejor.get("fecha_ida", ""),
            "fecha_vuelta": mejor.get("fecha_vuelta", ""),
            "aerolinea": mejor.get("aerolinea", "—"),
            "umbral": umbral,
            "mediana": round(mediana),
            "descuento": max(0, descuento),
            "esGanga": bool(es_ganga),
            "link": link_vuelos(origen, ciudad, mejor.get("fecha_ida", ""), mejor.get("fecha_vuelta", "")),
        })

    # Ordenar: primero gangas, luego por precio ascendente.
    salida.sort(key=lambda r: (not r["esGanga"], r["precio"]))

    doc = {
        "generado": datetime.now().isoformat(timespec="seconds"),
        "moneda": config.MONEDA,
        "origenes": ORIGENES,
        "rutas": salida,
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(salida)} ofertas escritas en {SALIDA}")


if __name__ == "__main__":
    main()
