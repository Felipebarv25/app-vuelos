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
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

import config

load_dotenv()  # marker de afiliado, etc. (en GitHub Actions van como variables)

RAIZ = os.path.dirname(__file__)
HISTORIAL = os.path.join(RAIZ, "datos", "historial.csv")
SALIDA = os.path.join(RAIZ, "web", "public", "ofertas.json")
SALIDA_RESUMEN = os.path.join(RAIZ, "web", "public", "historial-resumen.json")

# Hubs origen (IATA → ciudad legible) — Fase 2 multi-pais. Debe coincidir con
# config.ORIGENES y con web/lib/paisesOrigen.js (PAISES_ORIGEN[*].hubs).
ORIGENES = {
    "BOG": "Bogotá",
    "MDE": "Medellín",
    "MEX": "Ciudad de México",
    "UIO": "Quito",
    "LIM": "Lima",
    "SCL": "Santiago",
    "EZE": "Buenos Aires",
    "GRU": "São Paulo",
    "CCS": "Caracas",
    "MAD": "Madrid",
    "MIA": "Miami",
}

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
# Ventana de frescura del precio "actual" (audit 2026-07-05: usuario reporto
# precio de hace 18h muy distinto a Google). Solo se muestra el precio como
# vigente si fue verificado en las ultimas 3 horas. Si es mas viejo, la ruta
# se OMITE del ofertas.json. Con el detector corriendo cada hora (2026-07-18)
# esto deja 2 corridas de margen antes de considerar el precio obsoleto.
HORAS_FRESCO = 3


def _ddmm(iso):
    """'YYYY-MM-DD' -> 'DDMM' (formato de fecha de los deep-links de Aviasales)."""
    return (iso[8:10] + iso[5:7]) if iso and len(iso) >= 10 else ""


def link_aviasales(origen, destino, fecha_ida, fecha_vuelta):
    """Deep-link al BUSCADOR real de Aviasales para esas fechas exactas (con tu
    marker de afiliado). Lleva a un precio reservable de verdad, no a un número
    viejo. Formato: ORIGEN+DDMM(ida)+DESTINO+DDMM(vuelta)+pasajeros."""
    di = _ddmm(fecha_ida)
    if not di:
        return ""
    code = f"{origen}{di}{destino}{_ddmm(fecha_vuelta)}1"
    url = "https://www.aviasales.com/search/" + code
    marker = os.environ.get("TRAVELPAYOUTS_MARKER", "")
    return url + (f"?marker={marker}" if marker else "")


def link_google(origen, ciudad, fecha_ida, fecha_vuelta):
    """Enlace a Google Vuelos (para comparar/verificar el precio)."""
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

    def _parse_ts(s):
        """Timestamp ISO -> datetime AWARE en UTC, tolerante a formatos.
        Las filas nuevas traen +00:00 explicito; las viejas son naive pero
        siempre se escribieron desde GitHub Actions (UTC), asi que a las
        naive les fijamos tz=UTC en vez de adivinar hora local."""
        if not s:
            return None
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            try:
                dt = datetime.fromisoformat(s[:19])
            except Exception:
                return None
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    umbral_fresco = datetime.now(timezone.utc) - timedelta(hours=HORAS_FRESCO)
    salida = []
    for (origen, destino), filas in rutas.items():
        if origen not in ORIGENES or destino not in META:
            continue
        # La mediana (línea base para el % de descuento) se calcula sobre TODO el
        # historial de la ruta: refleja "lo que suele costar".
        precios = [r["precio"] for r in filas]
        mediana = statistics.median(precios)

        # PRECIO ACTUAL = el más barato de las últimas HORAS_FRESCO horas. Si
        # ninguna fila cae en esa ventana, la ruta se OMITE (no mostramos un
        # precio que probablemente ya no existe). Antes usábamos "último día",
        # lo que podía dejar precios de hace 18h como los mostrados al usuario.
        recientes = [
            r for r in filas
            if (ts := _parse_ts(r.get("timestamp", ""))) and ts >= umbral_fresco
        ]
        if not recientes:
            continue
        mejor = min(recientes, key=lambda r: r["precio"])
        precio = mejor["precio"]

        descuento = round((1 - precio / mediana) * 100) if mediana else 0
        umbral = config.DESTINOS.get(destino, ("", 0))[1]
        # "Ganga" = descuento REAL y notable: 15%+ bajo lo habitual, o bien
        # claramente por debajo de tu umbral objetivo (no apenas rozándolo).
        es_ganga = (mediana and precio <= mediana * (1 - DESCUENTO_GANGA)) or (umbral and precio <= umbral * 0.85)
        ciudad, pais, bandera = META[destino]

        # Escalas: si la fila las trae como entero ("0", "1", ...), las pasamos;
        # si vienen vacias (filas viejas), las dejamos None para que la UI
        # sepa que no son datos confiables y no mienta diciendo "directo".
        def _esc(v):
            try:
                s = (v or "").strip()
                return int(s) if s != "" else None
            except (TypeError, ValueError):
                return None

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
            "escalas_ida": _esc(mejor.get("escalas_ida")),
            "escalas_vuelta": _esc(mejor.get("escalas_vuelta")),
            "umbral": umbral,
            "mediana": round(mediana),
            "descuento": max(0, descuento),
            "esGanga": bool(es_ganga),
            "visto": mejor.get("timestamp", ""),  # cuándo se vio este precio
            "link": link_aviasales(origen, destino, mejor.get("fecha_ida", ""), mejor.get("fecha_vuelta", "")),
            "link_google": link_google(origen, ciudad, mejor.get("fecha_ida", ""), mejor.get("fecha_vuelta", "")),
        })

    # Ordenar: primero gangas, luego por precio ascendente.
    salida.sort(key=lambda r: (not r["esGanga"], r["precio"]))

    doc = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "moneda": config.MONEDA,
        "origenes": ORIGENES,
        "rutas": salida,
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(salida)} ofertas escritas en {SALIDA}")


MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


DIAS_FRESCOS_RESUMEN = 7


def _parse_ts_safe(s):
    """Timestamp ISO -> datetime UTC, tolerante."""
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.fromisoformat(s[:19])
        except Exception:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _esc_resumen(v):
    try:
        s = (v or "").strip()
        return int(s) if s != "" else None
    except (TypeError, ValueError):
        return None


def generar_resumen():
    """Genera historial-resumen.json: el vuelo más barato detectado por mes
    y destino, con todos los datos del vuelo. VuelosBaratos.js lo consume
    client-side en Vercel (el CSV no está disponible ahí).

    Solo incluye precios vistos en los últimos DIAS_FRESCOS_RESUMEN días
    para que los precios mostrados sean cercanos a la realidad actual."""
    if not os.path.exists(HISTORIAL):
        print("Resumen: sin historial.")
        return

    umbral_fresco = datetime.now(timezone.utc) - timedelta(days=DIAS_FRESCOS_RESUMEN)
    hoy = date.today().isoformat()

    # {destino: {"YYYY-MM": {mejor fila}}}
    destinos = {}
    with open(HISTORIAL, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                precio = float(fila["precio"])
            except (TypeError, ValueError, KeyError):
                continue
            if precio <= 0:
                continue
            dest = fila.get("destino", "")
            ida = fila.get("fecha_ida", "")
            if not dest or len(ida) < 7:
                continue
            if ida < hoy:
                continue
            ts = _parse_ts_safe(fila.get("timestamp", ""))
            if not ts or ts < umbral_fresco:
                continue
            ym = ida[:7]
            if dest not in destinos:
                destinos[dest] = {}
            actual = destinos[dest].get(ym)
            if not actual or precio < actual["precio"]:
                destinos[dest][ym] = {
                    "precio": precio,
                    "origen": fila.get("origen", ""),
                    "ida": ida,
                    "vuelta": fila.get("fecha_vuelta", ""),
                    "aerolinea": (fila.get("aerolinea") or "").strip(),
                    "escalas_ida": _esc_resumen(fila.get("escalas_ida")),
                    "escalas_vuelta": _esc_resumen(fila.get("escalas_vuelta")),
                    "visto": fila.get("timestamp", ""),
                }

    doc = {}
    for dest, meses in destinos.items():
        vuelos = []
        for ym, v in sorted(meses.items()):
            mi = int(ym[5:7]) - 1
            anio = ym[:4]
            vuelos.append({
                "ym": ym,
                "anio": anio,
                "label": f"{MESES_ES[mi]} {anio[2:]}",
                **v,
            })
        precios = [v["precio"] for v in vuelos]
        promedio = round(sum(precios) / len(precios)) if precios else 0
        doc[dest] = {"vuelos": vuelos, "promedio": promedio}

    os.makedirs(os.path.dirname(SALIDA_RESUMEN), exist_ok=True)
    with open(SALIDA_RESUMEN, "w", encoding="utf-8") as f:
        json.dump({"generado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "destinos": doc}, f, ensure_ascii=False)

    total = sum(len(d["vuelos"]) for d in doc.values())
    print(f"OK: resumen de {len(doc)} destinos, {total} meses en {SALIDA_RESUMEN}")


if __name__ == "__main__":
    main()
    generar_resumen()
