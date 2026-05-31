# -*- coding: utf-8 -*-
"""
Detector de vuelos internacionales económicos desde Colombia.

Uso:  python detector.py
"""
import time
from datetime import date

from dotenv import load_dotenv

import config
from travelpayouts import buscar_oferta_mas_barata
from almacenamiento import (guardar_precio, minimo_historico,
                            registrar_alerta, ya_se_alerto)
from notificaciones import notificar

load_dotenv()  # carga las credenciales del archivo .env


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


def main():
    meses = generar_meses()
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
                minimo_previo = minimo_historico(origen, destino)
                guardar_precio(origen, destino, fecha_ida, fecha_vuelta, oferta)

                es_ganga = precio <= umbral
                nuevo_minimo = (config.AVISAR_NUEVO_MINIMO
                                and minimo_previo is not None
                                and precio < minimo_previo)

                if es_ganga or nuevo_minimo:
                    clave = f"{origen}-{destino}-{fecha_ida}-{int(precio)}"
                    if ya_se_alerto(clave):
                        continue
                    razon = (f"por debajo de tu umbral (US$ {umbral})"
                             if es_ganga else "nuevo mínimo histórico")
                    mensaje = (
                        f"✈️ <b>¡Oferta detectada!</b>\n\n"
                        f"<b>{origen} → {nombre} ({destino})</b>\n"
                        f"💵 US$ {precio:.0f} ida y vuelta ({razon})\n"
                        f"📅 {fecha_ida} → {fecha_vuelta}\n"
                        f"🛫 Aerolínea: {oferta['aerolinea']}\n"
                        f"🔗 {oferta['link']}\n\n"
                        f"Verifica el precio final antes de reservar."
                    )
                    print(f"  >> OFERTA: {origen}->{destino} US${precio:.0f}")
                    notificar(f"Oferta de vuelo: {origen} a {nombre}", mensaje)
                    registrar_alerta(clave)
                    ofertas += 1

                time.sleep(config.ESPERA_ENTRE_LLAMADAS)

    print(f"Listo. Ofertas notificadas en esta corrida: {ofertas}")


if __name__ == "__main__":
    main()
