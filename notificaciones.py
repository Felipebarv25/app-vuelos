# -*- coding: utf-8 -*-
"""Envío de alertas por Telegram y/o correo electrónico.

Cada canal se activa solo si sus variables están definidas en el .env.
Puedes usar uno, otro o ambos.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage

import requests


def enviar_telegram(mensaje):
    token = os.environ.get("TELEGRAM_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat_id, "text": mensaje, "parse_mode": "HTML"},
            timeout=30,
        )
    except Exception as e:
        print(f"  ! No se pudo enviar por Telegram: {e}")


def enviar_correo(asunto, cuerpo):
    remitente = os.environ.get("EMAIL_REMITENTE")
    password = os.environ.get("EMAIL_PASSWORD")
    destinatario = os.environ.get("EMAIL_DESTINATARIO")
    if not remitente or not password or not destinatario:
        return
    # El cuerpo trae etiquetas HTML de Telegram; las quitamos para el correo.
    texto = (cuerpo.replace("<b>", "").replace("</b>", ""))
    msg = EmailMessage()
    msg["From"] = remitente
    msg["To"] = destinatario
    msg["Subject"] = asunto
    msg.set_content(texto)
    try:
        contexto = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=contexto) as s:
            s.login(remitente, password)
            s.send_message(msg)
    except Exception as e:
        print(f"  ! No se pudo enviar el correo: {e}")


def notificar(asunto, mensaje):
    enviar_telegram(mensaje)
    enviar_correo(asunto, mensaje)
