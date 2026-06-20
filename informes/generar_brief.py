#!/usr/bin/env python3
"""
Generador del INFORME EJECUTIVO SEMANAL ("brief 360") de Viajero 360.

Hace dos cosas:
  1) (Opcional) Genera contenido FRESCO de inteligencia de negocio con IA
     (Anthropic + búsqueda web), si está ANTHROPIC_API_KEY. Así el informe se
     "actualiza casi en tiempo real" cada semana.
  2) Renderiza un Markdown a un PDF con la identidad de Viajero 360 (portada,
     tablas, encabezado/pie). Siempre funciona, haya o no IA.

Uso:
    # Renderizar un markdown existente a PDF
    python informes/generar_brief.py --md informes/brief-2026-06-20.md

    # Generar contenido nuevo con IA y luego renderizar (requiere API key)
    python informes/generar_brief.py --generar-con-ia

Dependencias: weasyprint, markdown  (pip install weasyprint markdown)
Para la IA:   anthropic              (pip install anthropic)
"""
import argparse
import datetime as dt
import os
import re
import sys

import markdown as md_lib
from weasyprint import HTML

AQUI = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Identidad visual (alineada con la marca: teal "océano" + acento naranja).
# ---------------------------------------------------------------------------
CSS = """
@page {
  size: A4;
  margin: 22mm 18mm 20mm 18mm;
  @bottom-center {
    content: "Viajero 360 · Informe ejecutivo confidencial · página " counter(page) " de " counter(pages);
    font-size: 8pt; color: #94a3b8;
  }
}
@page :first { margin: 0; @bottom-center { content: ""; } }
* { box-sizing: border-box; }
body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1e293b; font-size: 10.5pt; line-height: 1.5; }

/* Portada */
.portada {
  height: 297mm; padding: 32mm 24mm;
  background: linear-gradient(135deg, #0f766e 0%, #0f3d3a 100%);
  color: #fff; page-break-after: always; position: relative;
}
.portada .marca { font-size: 13pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .9; }
.portada .marca span { color: #f4633f; }
.portada h1 { font-size: 34pt; font-weight: 800; line-height: 1.08; margin-top: 90mm; letter-spacing: -.5pt; color: #fff; border: none; padding: 0; }
.portada .sub { font-size: 13pt; opacity: .9; margin-top: 6mm; max-width: 130mm; }
.portada .meta { position: absolute; bottom: 28mm; left: 24mm; font-size: 10pt; opacity: .85; }
.portada .meta b { color: #f4633f; }
.portada .pill { display: inline-block; border: 1px solid rgba(255,255,255,.4); border-radius: 999px;
  padding: 3pt 12pt; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; margin-top: 8mm; }

/* Cuerpo */
h1 { font-size: 17pt; color: #0f3d3a; border-bottom: 2.5pt solid #0f766e; padding-bottom: 3pt;
  margin: 16pt 0 8pt; page-break-after: avoid; }
h2 { font-size: 13pt; color: #0f766e; margin: 12pt 0 5pt; page-break-after: avoid; }
h3 { font-size: 11pt; color: #0f3d3a; margin: 9pt 0 4pt; }
p { margin: 4pt 0; }
ul, ol { margin: 4pt 0 6pt 16pt; }
li { margin: 2pt 0; }
strong { color: #0f3d3a; }
a { color: #0f766e; text-decoration: none; word-break: break-all; }
hr { border: none; border-top: 1pt solid #e2e8f0; margin: 12pt 0; }
code { background: #f1f5f9; padding: 1pt 4pt; border-radius: 3pt; font-size: 9.5pt; }

table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9.5pt; page-break-inside: avoid; }
th { background: #0f766e; color: #fff; text-align: left; padding: 5pt 7pt; font-weight: 700; }
td { padding: 5pt 7pt; border-bottom: 1pt solid #e2e8f0; vertical-align: top; }
tr:nth-child(even) td { background: #f6f7fb; }

blockquote { margin: 8pt 0; padding: 6pt 12pt; background: #ecfdf5; border-left: 3pt solid #059669;
  color: #065f46; font-style: italic; }
"""

PORTADA = """
<div class="portada">
  <div class="marca">Viajero <span>360</span></div>
  <div class="pill">Informe ejecutivo · 360°</div>
  <h1>Brief estratégico<br>del negocio</h1>
  <div class="sub">Competencia · condiciones del mercado · necesidades del consumidor · entornos</div>
  <div class="meta">
    Semana del <b>{fecha}</b><br>
    Preparado para: Felipe (Fundador)<br>
    Documento confidencial — uso interno
  </div>
</div>
"""


def md_a_html(md_texto: str) -> str:
    cuerpo = md_lib.markdown(
        md_texto,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )
    return cuerpo


def construir_pdf(md_path: str, out_path: str, fecha: str):
    with open(md_path, "r", encoding="utf-8") as f:
        md_texto = f.read()
    cuerpo = md_a_html(md_texto)
    html = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>{CSS}</style></head><body>
{PORTADA.format(fecha=fecha)}
{cuerpo}
</body></html>"""
    HTML(string=html, base_url=AQUI).write_pdf(out_path)
    print(f"✅ PDF generado: {out_path}")


# ---------------------------------------------------------------------------
# (Opcional) Generación de contenido fresco con IA + búsqueda web.
# Si no hay ANTHROPIC_API_KEY o falla, se omite y se usa el .md existente.
# Esto es lo que hace que el informe se "actualice casi en tiempo real".
# ---------------------------------------------------------------------------
PROMPT_IA = """Eres analista senior de negocio y de la industria de viajes. Genera
el contenido de un INFORME EJECUTIVO SEMANAL ("brief 360") para Viajero 360, una
app/web de planificación de viajes enfocada en Latinoamérica (español), con datos
reales (OpenStreetMap, Wikidata, Passport Index), presupuesto-primero, detector de
vuelos baratos desde Colombia, requisitos de visa, e itinerarios día a día.

Investiga con búsqueda web el estado ACTUAL (esta semana) y entrega SOLO Markdown
con estas secciones, en español, conciso y accionable:
# Resumen ejecutivo (3 conclusiones)
# 1. Condiciones del mercado
# 2. Análisis competitivo (tabla)
# 3. Necesidades del consumidor
# 4. Análisis de entornos (PESTEL)
# 5. Posición de Viajero 360 (FODA)
# 6. Recomendaciones de la semana (priorizadas 🔴🟡🟢)
# 7. KPIs a vigilar (tabla)

Competidores a vigilar: Wanderlog, TripIt, Hopper, Going, Layla, Mindtrip, Roam
Around, Kiwi, Turismocity. Cita fuentes reales con URL al final. No inventes datos:
si no encuentras algo, dilo."""


def generar_con_ia(out_md_path: str) -> bool:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ℹ️  Sin ANTHROPIC_API_KEY: omito la generación con IA.")
        return False
    try:
        import anthropic
    except ImportError:
        print("ℹ️  Falta el paquete 'anthropic' (pip install anthropic). Omito IA.")
        return False
    try:
        modelo = os.environ.get("BRIEF_MODELO", "claude-opus-4-8")
        cliente = anthropic.Anthropic(api_key=api_key)
        resp = cliente.messages.create(
            model=modelo,
            max_tokens=8000,
            messages=[{"role": "user", "content": PROMPT_IA}],
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 8}],
        )
        # Concatenar los bloques de texto de la respuesta.
        partes = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
        md_texto = "\n".join(partes).strip()
        if not md_texto:
            print("⚠️  La IA no devolvió texto utilizable. Omito.")
            return False
        with open(out_md_path, "w", encoding="utf-8") as f:
            f.write(md_texto)
        print(f"✅ Contenido IA guardado: {out_md_path}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"⚠️  Falló la generación con IA ({e}). Uso el .md existente.")
        return False


def main():
    hoy = dt.date.today()
    fecha_legible = hoy.strftime("%d/%m/%Y")
    md_default = os.path.join(AQUI, f"brief-{hoy.isoformat()}.md")

    ap = argparse.ArgumentParser(description="Genera el brief ejecutivo semanal en PDF.")
    ap.add_argument("--md", help="Ruta del Markdown fuente.", default=None)
    ap.add_argument("--out", help="Ruta del PDF de salida.", default=None)
    ap.add_argument("--generar-con-ia", action="store_true",
                    help="Genera contenido fresco con IA antes de renderizar.")
    args = ap.parse_args()

    md_path = args.md or md_default
    if args.generar_con_ia:
        generar_con_ia(md_path)

    # Resiliencia: si no existe el Markdown del día (p.ej. la IA no corrió),
    # usamos el brief más reciente disponible para no fallar la automatización.
    if not os.path.exists(md_path):
        import glob
        previos = sorted(glob.glob(os.path.join(AQUI, "brief-*.md")))
        if previos:
            md_path = previos[-1]
            print(f"ℹ️  Sin brief del día; uso el más reciente: {md_path}")
        else:
            print(f"❌ No existe ningún Markdown de brief en {AQUI}")
            sys.exit(1)

    out_path = args.out or md_path.replace(".md", ".pdf")
    construir_pdf(md_path, out_path, fecha_legible)


if __name__ == "__main__":
    main()
