# -*- coding: utf-8 -*-
"""Ayudante: detecta tu chat_id de Telegram y lo guarda en el .env.

1. Abre tu bot y mándale un mensaje (ej. "hola").
2. Ejecuta:  python obtener_chat_id.py
3. Si encuentra el chat_id, lo escribe solo en el .env.
"""
import json
import os
import re

import requests
from dotenv import load_dotenv

load_dotenv()

RUTA_ENV = os.path.join(os.path.dirname(__file__), ".env")
token = os.environ.get("TELEGRAM_TOKEN", "").strip()

if not token:
    print("RESULTADO: Falta TELEGRAM_TOKEN en el .env")
    raise SystemExit

me = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=30).json()
if not me.get("ok"):
    print("RESULTADO: Token invalido")
    raise SystemExit

upd = requests.get(
    f"https://api.telegram.org/bot{token}/getUpdates", timeout=30).json()

encontrados = {}
for u in upd.get("result", []):
    msg = (u.get("message") or u.get("edited_message")
           or u.get("my_chat_member") or {})
    chat = msg.get("chat") or {}
    if chat.get("id"):
        encontrados[chat["id"]] = chat.get("first_name") or chat.get("title") or ""

if not encontrados:
    print("RESULTADO: SIN_MENSAJES")
    raise SystemExit

chat_id = list(encontrados.keys())[0]
nombre = encontrados[chat_id]

# Guardar el chat_id en el .env automáticamente
with open(RUTA_ENV, "r", encoding="utf-8") as f:
    contenido = f.read()
contenido = re.sub(r"TELEGRAM_CHAT_ID=.*",
                   f"TELEGRAM_CHAT_ID={chat_id}", contenido)
with open(RUTA_ENV, "w", encoding="utf-8") as f:
    f.write(contenido)

print(f"RESULTADO: OK chat_id={chat_id} nombre={nombre} (guardado en .env)")
