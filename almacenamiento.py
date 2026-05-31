# -*- coding: utf-8 -*-
"""Guarda el historial de precios y las alertas ya enviadas en archivos CSV.

Usamos CSV (no una base de datos) para que puedas abrir el historial
directamente en Excel y ver cómo evolucionan los precios.
"""
import csv
import os
from datetime import datetime

CARPETA_DATOS = os.path.join(os.path.dirname(__file__), "datos")
ARCHIVO_HISTORIAL = os.path.join(CARPETA_DATOS, "historial.csv")
ARCHIVO_ALERTAS = os.path.join(CARPETA_DATOS, "alertas_enviadas.csv")

CAMPOS_HISTORIAL = ["timestamp", "origen", "destino", "fecha_ida",
                    "fecha_vuelta", "precio", "moneda", "aerolinea"]


def _asegurar_archivo(ruta, campos):
    os.makedirs(CARPETA_DATOS, exist_ok=True)
    if not os.path.exists(ruta):
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(campos)


def guardar_precio(origen, destino, fecha_ida, fecha_vuelta, oferta):
    _asegurar_archivo(ARCHIVO_HISTORIAL, CAMPOS_HISTORIAL)
    with open(ARCHIVO_HISTORIAL, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([
            datetime.now().isoformat(timespec="seconds"),
            origen, destino, fecha_ida, fecha_vuelta,
            oferta["precio"], oferta["moneda"], oferta["aerolinea"],
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
