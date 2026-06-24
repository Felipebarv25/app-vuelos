# 📊 Informes ejecutivos 360 — Viajero 360

Brief estratégico **semanal** del negocio: competencia, condiciones del mercado,
necesidades del consumidor y entornos (PESTEL/FODA). Pensado como documento
ejecutivo para tomar decisiones "360".

## Qué hay aquí

- `brief-YYYY-MM-DD.md` — contenido del informe de esa semana (texto fuente).
- `brief-YYYY-MM-DD.pdf` — el informe renderizado con la identidad de marca.
- `generar_brief.py` — generador: convierte el Markdown a PDF y, opcionalmente,
  refresca el contenido con IA + búsqueda web.

## Generar a mano

```bash
pip install weasyprint markdown          # PDF
# (opcional, para refrescar con IA)
pip install anthropic

# Renderizar un brief existente a PDF
python informes/generar_brief.py --md informes/brief-2026-06-20.md

# Generar contenido FRESCO con IA (requiere ANTHROPIC_API_KEY) y renderizar
export ANTHROPIC_API_KEY=sk-ant-...
python informes/generar_brief.py --generar-con-ia
```

## Automatización (semanal)

El workflow `.github/workflows/brief-semanal.yml` corre **cada lunes 12:00 UTC**
(≈ 7:00 a.m. Colombia) y también se puede lanzar a mano desde **Actions →
Brief ejecutivo semanal → Run workflow**.

Para que el informe se "actualice casi en tiempo real" con investigación web:

1. Crea el secret **`ANTHROPIC_API_KEY`** en GitHub
   (*Settings → Secrets and variables → Actions → New repository secret*).
2. Listo: cada semana la IA investiga la competencia y el mercado, escribe el
   `brief-<fecha>.md`, lo renderiza a PDF y commitea ambos a `informes/`.

Sin la API key, el workflow igual genera un PDF (usando el último brief
disponible), pero **no** refresca el contenido — por eso la key es la pieza que
le da el valor de "inteligencia en vivo".

> Nota: el modelo se controla con la variable `BRIEF_MODELO` (por defecto
> `claude-opus-4-8`). La generación con IA está marcada para validar en la
> próxima sesión de trabajo con la API key real.
