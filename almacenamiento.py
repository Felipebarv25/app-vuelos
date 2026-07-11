# -*- coding: utf-8 -*-
"""Guarda el historial de precios y las alertas ya enviadas en archivos CSV.

Usamos CSV (no una base de datos) para que puedas abrir el historial
directamente en Excel y ver cómo evolucionan los precios.
"""
import csv
import os
from datetime import datetime, timezone

CARPETA_DATOS = os.path.join(os.path.dirname(__file__), "datos")
ARCHIVO_HISTORIAL = os.path.join(CARPETA_DATOS, "historial.csv")
ARCHIVO_ALERTAS = os.path.join(CARPETA_DATOS, "alertas_enviadas.csv")

CAMPOS_HISTORIAL = ["timestamp", "origen", "destino", "fecha_ida",
                    "fecha_vuelta", "precio", "moneda", "aerolinea",
                    "escalas_ida", "escalas_vuelta"]


def _asegurar_archivo(ruta, campos):
    os.makedirs(CARPETA_DATOS, exist_ok=True)
    if not os.path.exists(ruta):
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(campos)


def guardar_precio(origen, destino, fecha_ida, fecha_vuelta, oferta):
    _asegurar_archivo(ARCHIVO_HISTORIAL, CAMPOS_HISTORIAL)
    with open(ARCHIVO_HISTORIAL, "a", newline="", encoding="utf-8") as f:
        # Las filas historicas anteriores al 2026-06-24 no tienen las columnas
        # escalas_ida/vuelta — csv.DictReader las leera como None, lo cual es OK
        # porque el frontend trata None como "desconocido" sin asumir directo.
        # Timestamp SIEMPRE en UTC explicito (+00:00). Antes era naive
        # (datetime.now() del runner de Actions = UTC sin marcar) y el
        # navegador en Colombia lo parseaba como hora LOCAL: los precios se
        # veian 5 horas mas frescos de lo real (lectura 360 2026-07-11).
        csv.writer(f).writerow([
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            origen, destino, fecha_ida, fecha_vuelta,
            oferta["precio"], oferta["moneda"], oferta["aerolinea"],
            oferta.get("escalas_ida", ""),
            oferta.get("escalas_vuelta", ""),
        ])


def minimo_historico(origen, destino):
    """Precio mínimo previo registrado para la ruta origen-destino, o None."""
    if not os.path.exists(ARCHIVO_HISTORIAL):
        return None
    precios = []
    with open(ARCHIVO_HISTORIAL, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            if fila["origen"] == origen and fila["destino"] == destino:
                precios.append(float(fila["precio"]))
    return min(precios) if precios else None


def cargar_precios_por_ruta_mes():
    """Devuelve un índice {(origen, destino, mes_salida): [precios previos]}.

    Se carga una sola vez al inicio para que la detección inteligente sea
    rápida (no releer el CSV en cada consulta). El 'mes_salida' es YYYY-MM
    de la fecha de ida, para comparar peras con peras (un mismo viaje).
    """
    idx = {}
    if not os.path.exists(ARCHIVO_HISTORIAL):
        return idx
    with open(ARCHIVO_HISTORIAL, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            try:
                precio = float(fila["precio"])
            except (TypeError, ValueError, KeyError):
                continue
            mes = (fila.get("fecha_ida") or "")[:7]
            clave = (fila["origen"], fila["destino"], mes)
            idx.setdefault(clave, []).append(precio)
    return idx


def ya_se_alerto(clave):
    if not os.path.exists(ARCHIVO_ALERTAS):
        return False
    with open(ARCHIVO_ALERTAS, newline="", encoding="utf-8") as f:
        return any(fila and fila[0] == clave for fila in csv.reader(f))


def registrar_alerta(clave):
    _asegurar_archivo(ARCHIVO_ALERTAS, ["clave", "timestamp"])
    with open(ARCHIVO_ALERTAS, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(
            [clave, datetime.now().isoformat(timespec="seconds")])
