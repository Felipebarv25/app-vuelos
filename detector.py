# -*- coding: utf-8 -*-
"""
Detector de vuelos internacionales económicos desde Colombia.

Uso:  python detector.py
"""
import os
import statistics
import time
from datetime import date

import requests
from dotenv import load_dotenv

import config
from travelpayouts import buscar_oferta_mas_barata
from almacenamiento import (cargar_precios_por_ruta_mes, guardar_precio,
                            registrar_alerta, ya_se_alerto)
from notificaciones import notificar

load_dotenv()  # carga las credenciales del archivo .env

# Endpoint en Vercel que recibe los precios detectados y dispara emails a los
# usuarios con alertas activas. Si ALERTS_SHARED_SECRET no esta configurado
# (entorno local sin secret, o secret no propagado al cron), el detector
# sigue funcionando normal y solo se omite la llamada.
ALERTS_URL = os.environ.get(
    "ALERTS_URL",
    "https://anduve-app.vercel.app/api/alertas/disparar",
)
ALERTS_SECRET = os.environ.get("ALERTS_SHARED_SECRET", "")


def notificar_alertas_web(origen, destino, precio, fecha_ida, fecha_vuelta,
                          link, aerolinea, promedio_ruta=None):
    """Avisa al endpoint Vercel que vio un precio. La app busca usuarios con
    alertas para ese destino cuyo umbral cumpla y les manda email. Best-effort:
    si falla la red o el secret no esta, no rompe la corrida.

    promedio_ruta: opcional. Promedio historico (origen, destino) usado por la
    API para filtrar "anti-spam" — solo envia email si el precio esta al menos
    20% bajo este promedio. Si no se pasa, solo aplica el umbral del usuario.
    """
    if not ALERTS_SECRET:
        return
    try:
        requests.post(
            ALERTS_URL,
            headers={
                "X-Alert-Secret": ALERTS_SECRET,
                "Content-Type": "application/json",
                "User-Agent": "Anduve-Detector/1.0",
            },
            json={
                "origen": origen,
                "iata": destino,
                "precio": precio,
                "fecha_ida": fecha_ida,
                "fecha_vuelta": fecha_vuelta,
                "link": link,
                "aerolinea": aerolinea,
                "promedio_ruta": promedio_ruta,
            },
            timeout=8,
        )
    except Exception as e:
        # No detenemos al detector por esto: las alertas son secundarias al
        # objetivo primario (escanear precios y guardar historial).
        print(f"  ! No se pudo notificar alertas web: {e}")


def promedio_ruta_completa(historial, origen, destino):
    """Promedio de TODOS los precios historicos para (origen, destino),
    independiente del mes de salida. Sirve para que la API decida si una
    oferta es realmente una ganga (>=20% bajo este promedio) y no spamee
    al usuario con precios que apenas bajan del umbral pero no son notables.
    Retorna None si no hay datos."""
    todos = []
    for (o, d, _mes), precios in historial.items():
        if o == origen and d == destino:
            todos.extend(precios)
    if not todos:
        return None
    return sum(todos) / len(todos)


def generar_meses():
    """Genera los próximos meses en formato 'YYYY-MM'."""
    hoy = date.today()
    meses = []
    for i in range(1, config.MESES_A_EXPLORAR + 1):
        total = hoy.month - 1 + i
        anio = hoy.year + total // 12
        mes = total % 12 + 1
        meses.append(f"{anio:04d}-{mes:02d}")
    return meses


def _percentil(datos, p):
    """Percentil p (0-100) de una lista, sin librerías externas."""
    s = sorted(datos)
    if not s:
        return None
    k = (len(s) - 1) * p / 100.0
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


def evaluar_oferta(precio, umbral, historico):
    """Decide si un precio es una ganga REAL y por qué.

    Devuelve (es_ganga: bool, razon: str). La idea es no "avisar por avisar":
    el precio debe estar bajo tu umbral Y además ser excepcional frente a lo
    que suele costar esa ruta en ese mes.
    """
    # 1) Techo absoluto: nunca avisamos por encima de tu umbral.
    if precio > umbral:
        return False, ""

    # 2) Con suficiente historia, comparamos contra el comportamiento normal.
    if len(historico) >= config.MIN_MUESTRAS_HISTORIAL:
        mediana = statistics.median(historico)
        p_baja = _percentil(historico, config.PERCENTIL_GANGA)
        minimo = min(historico)
        ahorro = round((1 - precio / mediana) * 100)
        # Margen mínimo (mitad del descuento) para que un "nuevo mínimo" trivial
        # (apenas 1-3% bajo lo normal) NO genere ruido.
        margen_min = config.DESCUENTO_MINIMO / 2

        if precio < minimo and precio <= mediana * (1 - margen_min):
            return True, f"🔥 NUEVO MÍNIMO histórico para esas fechas ({ahorro}% bajo lo normal)"
        if precio <= p_baja and precio <= mediana * (1 - margen_min):
            return True, f"entre los más baratos vistos para esas fechas ({ahorro}% bajo lo normal)"
        if precio <= mediana * (1 - config.DESCUENTO_MINIMO):
            return True, f"{ahorro}% más barato que lo habitual (≈US$ {mediana:.0f})"
        return False, ""

    # 3) Cold start (poca historia): solo gangas claras para no hacer ruido.
    if precio <= umbral * (1 - config.DESCUENTO_MINIMO):
        return True, f"buen precio, bajo tu umbral de US$ {umbral}"
    return False, ""


def main():
    meses = generar_meses()
    historial = cargar_precios_por_ruta_mes()
    total = len(config.ORIGENES) * len(config.DESTINOS) * len(meses)
    print(f"Explorando {len(config.ORIGENES)} orígenes x "
          f"{len(config.DESTINOS)} destinos x {len(meses)} meses "
          f"= {total} consultas...")
    ofertas = 0

    for origen in config.ORIGENES:
        for destino, (nombre, umbral) in config.DESTINOS.items():
            for mes in meses:
                try:
                    oferta = buscar_oferta_mas_barata(
                        origen, destino, mes, config.MONEDA,
                        config.SOLO_DIRECTOS)
                except Exception as e:
                    print(f"  ! Error {origen}->{destino} {mes}: {e}")
                    time.sleep(config.ESPERA_ENTRE_LLAMADAS)
                    continue
                if not oferta:
                    continue

                precio = oferta["precio"]
                fecha_ida = oferta["fecha_ida"]
                fecha_vuelta = oferta["fecha_vuelta"]
                mes_salida = fecha_ida[:7]

                # Historia previa de ESTA ruta y mes (antes de guardar la actual)
                historico = historial.get((origen, destino, mes_salida), [])
                guardar_precio(origen, destino, fecha_ida, fecha_vuelta, oferta)

                # Notificar a la app web para que dispare las alertas de los
                # usuarios cuyo umbral se cumpla (best-effort, no bloquea).
                # Pasamos el promedio historico de la ruta para que la API solo
                # envie email si es ganga real (precio <= promedio * 0.80).
                # Envuelto en try/except amplio: si el calculo del promedio o
                # la notificacion fallan por cualquier razon, el detector NO
                # debe abortar — su trabajo principal es escanear y guardar
                # precios, las alertas son secundarias.
                try:
                    promedio = promedio_ruta_completa(historial, origen, destino)
                    notificar_alertas_web(
                        origen=origen,
                        destino=destino,
                        precio=int(precio),
                        fecha_ida=fecha_ida,
                        fecha_vuelta=fecha_vuelta,
                        link=oferta.get("link", ""),
                        aerolinea=oferta.get("aerolinea", ""),
                        promedio_ruta=round(promedio) if promedio else None,
                    )
                except Exception as e:
                    print(f"  ! Error notificando alertas {origen}->{destino}: {e}")

                es_ganga, razon = evaluar_oferta(precio, umbral, historico)
                if not es_ganga:
                    continue

                clave = f"{origen}-{destino}-{fecha_ida}-{int(precio)}"
                if ya_se_alerto(clave):
                    continue

                mensaje = (
                    f"✈️ <b>¡OFERTA REAL detectada!</b>\n\n"
                    f"<b>{origen} → {nombre} ({destino})</b>\n"
                    f"💵 <b>US$ {precio:.0f}</b> ida y vuelta\n"
                    f"✨ {razon}\n"
                    f"📅 {fecha_ida} → {fecha_vuelta}\n"
                    f"🛫 Aerolínea: {oferta['aerolinea']}\n"
                    f"🔗 Ver y reservar: {oferta['link']}\n\n"
                    f"Verifica el precio final antes de comprar."
                )
                print(f"  >> OFERTA: {origen}->{destino} US${precio:.0f} ({razon})")
                notificar(f"Oferta de vuelo: {origen} a {nombre}", mensaje)
                registrar_alerta(clave)
                ofertas += 1

                time.sleep(config.ESPERA_ENTRE_LLAMADAS)

    print(f"Listo. Ofertas notificadas en esta corrida: {ofertas}")


if __name__ == "__main__":
    main()
