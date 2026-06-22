# 🌍 Anduve

App de viajes "todo en uno" hecha con **Next.js**. Planea itinerarios día a día
para **cualquier ciudad del mundo**, con mapa, GPS, transporte y los mejores
lugares y restaurantes. Todo con datos **gratuitos** (OpenStreetMap).

## ✨ Qué hace

- 🔎 **Busca cualquier ciudad** (Nominatim / OpenStreetMap).
- 🗺️ **Mapa interactivo** con la ruta del día numerada.
- 📅 **Itinerario multi-día**: reparte los lugares en los días de tu viaje,
  contando el tiempo de visita + los desplazamientos para que "alcance el día".
- ☀️🌙 **Modo diurno y nocturno** (monumentos/museos vs bares/miradores).
- 🍽️ **Categorías**: imperdibles, restaurantes, cafés, bares, miradores.
- 🔄 **Cambiar o quitar** cualquier parada (ej. Bernabéu ↔ Banco de España).
- 🚇 **Transporte recomendado** entre puntos (a pie / metro-bus / taxi) con
  botón "Cómo llegar" que abre Google Maps (estaciones y transbordos reales).
- 📍 **GPS en vivo**: te ubica en el mapa y, con el cronómetro del día, te avisa
  si vas **adelantado o atrasado** respecto al plan.

## 🚀 Cómo correrla en tu PC

Requiere **Node.js 18+**.

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:3000

## ☁️ Cómo desplegarla en Vercel (gratis)

1. Sube el repositorio a GitHub (ya está).
2. Entra a https://vercel.com, inicia sesión con GitHub.
3. **Add New → Project** → elige tu repositorio.
4. En **Root Directory** selecciona la carpeta **`web`**.
5. **Deploy**. En ~1 min tendrás tu app en una URL pública `*.vercel.app`.

> No necesita variables de entorno: todas las fuentes de datos son públicas.

## 🧩 Estructura

```
web/
  app/          páginas y estilos (Next.js App Router)
    page.js     pantalla principal (orquesta todo)
    layout.js   estructura base + Leaflet
  components/   Mapa, Itinerario, UI
  lib/          lógica: osm (datos), rutas, itinerario, GPS, reloj
  public/       manifest PWA e icono
```

## 🔭 Próximas ideas (roadmap)

- Guardar viajes (localStorage o cuenta de usuario).
- Presupuesto de dinero por día.
- Clima por día y "qué llevar".
- Compartir itinerario por enlace.
- Integración con el detector de vuelos (abrir itinerario desde una oferta).
