"use client";
// Mapa de un viaje multiparada.
//
// No reutiliza Mapa.js a proposito. Aquel esta hecho para la ruta de UN dia
// dentro de UNA ciudad: rota la longitud con el scroll, abre fotos de cada
// lugar, pinta el hotel y hace zoom 13 sobre un punto. Aqui hace falta lo
// contrario: mirar paises enteros, numerar las paradas en el orden del viaje
// y unirlas con una linea. Meter los dos casos en un componente habria sido
// una lista de props excluyentes.
//
// El encuadre lo manda la ruta: el mapa se ajusta a las ciudades del viaje,
// que es lo que el usuario pidio ("filtrado por la zona en la que me estoy
// enfocando para cada viaje").
import { useEffect, useRef, useState } from "react";

const ESTILO = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
};

function asegurarCss() {
  if (typeof document === "undefined") return;
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

export default function MapaRuta({ paradas = [], alto = 320, textoFallo = "" }) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef([]);
  const [fallo, setFallo] = useState(false);

  // Solo las paradas que tienen coordenadas. Una ciudad sin geocodificar no
  // se puede pintar, y saltarsela es mejor que no pintar el mapa entero.
  const puntos = paradas
    .map((p, i) => ({ ...p, n: i + 1 }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  // Clave de contenido: si no cambia, no se vuelve a dibujar. Sin esto cada
  // tecla en "noches" repintaba todos los marcadores.
  const clave = puntos.map((p) => `${p.n}:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join("|");

  useEffect(() => {
    let cancelado = false;

    async function dibujar() {
      if (!ref.current || puntos.length === 0) return;
      asegurarCss();
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelado || !ref.current) return;

      if (!mapaRef.current) {
        const mapa = new maplibregl.Map({
          container: ref.current,
          style: ESTILO,
          center: [puntos[0].lon, puntos[0].lat],
          zoom: 3,
        });
        mapaRef.current = mapa;
        mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        // El scroll del raton es para leer la pagina: el mapa vive dentro de
        // una tarjeta larga y capturarlo dejaba al usuario atrapado en el.
        mapa.scrollZoom.disable();
        mapa.on("error", (e) => {
          console.warn("[MapaRuta]", e?.error?.message || "fallo del mapa");
          setFallo(true);
        });
      }
      const mapa = mapaRef.current;
      mapa.resize();

      // --- Lo que NO necesita el estilo: marcadores y encuadre --------------
      //
      // Esto va primero y sin esperar a nada, y no es un detalle de orden.
      // El dibujado colgaba entero del evento "load" de maplibre, y donde ese
      // evento no llega — probado: un mapa minimo en el mismo navegador se
      // queda con isStyleLoaded()=false para siempre — la tarjeta mostraba un
      // rectangulo gris sin una sola parada. Los marcadores y el encuadre no
      // dependen del estilo: se pintan ya, y si el mapa base no llega al menos
      // se ve el viaje.
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];

      for (const p of puntos) {
        const el = document.createElement("div");
        el.innerHTML =
          `<div style="background:#0f766e;color:#fff;width:26px;height:26px;border-radius:50%;` +
          `display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px;` +
          `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.n}</div>`;
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
              `<div style="font-weight:800;font-size:12.5px;color:#052b28">${p.n}. ${p.ciudad}</div>` +
                (p.iata ? `<div style="font-size:11px;color:#64748b">${p.iata}</div>` : "")
            )
          )
          .addTo(mapa);
        marcadoresRef.current.push(m);
      }

      if (puntos.length > 1) {
        const b = new maplibregl.LngLatBounds();
        puntos.forEach((p) => b.extend([p.lon, p.lat]));
        mapa.fitBounds(b, { padding: 56, maxZoom: 8, duration: 600 });
      } else {
        mapa.flyTo({ center: [puntos[0].lon, puntos[0].lat], zoom: 5, duration: 600 });
      }

      // --- Lo que SI necesita el estilo: la linea del recorrido -------------
      // addSource/addLayer solo funcionan con el estilo cargado. Se intenta
      // cuando ya lo esta y, si no, se reintenta un rato corto; si nunca
      // llega, el mapa se queda con sus paradas y sin linea, que es mucho
      // mejor que quedarse sin nada.
      const linea = () => {
        if (cancelado || !mapaRef.current) return;
        try { mapaRef.current.removeLayer("linea-ruta"); } catch {}
        try { mapaRef.current.removeSource("ruta"); } catch {}
        if (puntos.length < 2) return;
        mapaRef.current.addSource("ruta", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: puntos.map((p) => [p.lon, p.lat]) },
          },
        });
        mapaRef.current.addLayer({
          id: "linea-ruta",
          type: "line",
          source: "ruta",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#0f766e",
            "line-width": 2.5,
            "line-opacity": 0.8,
            "line-dasharray": [2, 1.6],
          },
        });
      };

      let intentos = 0;
      const cuandoHayaEstilo = () => {
        if (cancelado || !mapaRef.current) return;
        if (mapaRef.current.isStyleLoaded()) { try { linea(); } catch {} return; }
        if (intentos++ < 50) setTimeout(cuandoHayaEstilo, 120);
      };
      cuandoHayaEstilo();
    }

    dibujar();
    return () => { cancelado = true; };
    // `clave` resume el contenido: ver arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(
    () => () => {
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    []
  );

  if (puntos.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={ref}
        style={{ height: alto }}
        className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
      />
      {/* Si el mapa no carga, decirlo. Un rectangulo gris sin explicacion
          parece que la app se rompio; el viaje se planea igual sin el. */}
      {fallo && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-50 px-6 text-center text-[12.5px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {textoFallo}
        </div>
      )}
    </div>
  );
}
