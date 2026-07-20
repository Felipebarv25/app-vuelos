"use client";
import { useEffect, useRef } from "react";
import { nombreLocalizado } from "@/lib/nombres";

function lejos(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.6;
}

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

const COLORES_DIA = [
  "#4f46e5", "#ea580c", "#7c3aed", "#0d9488",
  "#c026d3", "#0284c7", "#65a30d",
];

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

const ZOOM_PARALLAX = 7;

export default function Mapa({
  centro,
  lugares = [],
  ubicacionUsuario = null,
  hospedaje = null,
  rutaTrazada = null,
  onClicLugar = null,
  onClicMapa = null,
  colorDia = 0,
  lang = "es",
}) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const markersRef = useRef([]);
  const centroAnterior = useRef(null);
  const onClicMapaRef = useRef(null);
  const primeraCarga = useRef(true);
  onClicMapaRef.current = onClicMapa;

  useEffect(() => {
    let maplibregl;
    let cancelado = false;

    async function init() {
      asegurarCss();
      maplibregl = (await import("maplibre-gl")).default;
      if (cancelado || !ref.current) return;

      const esNuevo = !mapaRef.current;

      if (esNuevo) {
        const mapa = new maplibregl.Map({
          container: ref.current,
          style: ESTILO,
          center: [centro[1], centro[0]],
          zoom: 2.5,
          pitch: 0,
          bearing: 0,
          maxPitch: 60,
        });

        mapa.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-left",
        );

        mapa.on("click", (e) => {
          onClicMapaRef.current?.(e.lngLat.lat, e.lngLat.lng);
        });

        // --- Parallax: scroll = rotar longitud con inercia (zoom < ZOOM_PARALLAX) ---
        let vel = 0;
        let animando = false;
        let congelado = false;

        function rotar() {
          if (Math.abs(vel) < 0.01 || congelado) {
            animando = false;
            vel = 0;
            return;
          }
          const c = mapa.getCenter();
          mapa.jumpTo({ center: [c.lng + vel, c.lat] });
          vel *= 0.93;
          requestAnimationFrame(rotar);
        }

        const onWheel = (e) => {
          if (mapa.getZoom() >= ZOOM_PARALLAX) return;
          e.preventDefault();
          e.stopPropagation();
          if (congelado) return;
          vel += e.deltaY * 0.015;
          vel = Math.max(-3, Math.min(3, vel));
          if (!animando) {
            animando = true;
            requestAnimationFrame(rotar);
          }
        };

        ref.current.addEventListener("wheel", onWheel, {
          capture: true,
          passive: false,
        });

        mapa.scrollZoom.disable();
        mapa.on("zoomend", () => {
          if (mapa.getZoom() >= ZOOM_PARALLAX) mapa.scrollZoom.enable();
          else mapa.scrollZoom.disable();
        });

        mapa._congelarRotacion = () => { congelado = true; };
        mapa._descongelarRotacion = () => { congelado = false; };

        mapaRef.current = mapa;
      }

      const mapa = mapaRef.current;
      try {
        ref.current.style.cursor = onClicMapa ? "crosshair" : "";
      } catch {}

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      ["route-shadow", "route-line", "ruta-trazada"].forEach((id) => {
        try { mapa.removeLayer(id); } catch {}
      });
      ["route", "ruta-trazada"].forEach((id) => {
        try { mapa.removeSource(id); } catch {}
      });

      const color = COLORES_DIA[colorDia % COLORES_DIA.length];
      const puntos = [];

      lugares.forEach((l, i) => {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;
          border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer">${i + 1}</div>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([l.coord[1], l.coord[0]])
          .addTo(mapa);

        const nombreLoc = nombreLocalizado(l, lang);
        const infoHtml = `<div style="font-weight:800;font-size:13px;color:#052b28">${i + 1}. ${nombreLoc}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:1px">${l.categoria || ""}${l.minutos ? ` · ~${l.minutos} min` : ""}${l.wiki ? " · ★ famoso" : ""}</div>
          <div style="font-size:10.5px;color:#4f46e5;font-weight:600;margin-top:2px">Clic para detalles</div>`;
        const fotoBox = (inner) =>
          `<div style="width:210px;height:110px;border-radius:9px;overflow:hidden;background:#e2e8f0;margin-bottom:6px;display:flex;align-items:center;justify-content:center">${inner}</div>`;

        let popup = null;
        let fotoPedida = false;
        let fotoUrl = null;

        el.addEventListener("mouseenter", () => {
          mapa._congelarRotacion?.();
          popup = new maplibregl.Popup({
            offset: 15,
            closeButton: false,
            closeOnClick: false,
            maxWidth: "250px",
          })
            .setLngLat([l.coord[1], l.coord[0]])
            .setHTML(
              fotoPedida && fotoUrl
                ? fotoBox(
                    `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover" alt="">`,
                  ) + infoHtml
                : fotoPedida
                  ? infoHtml
                  : fotoBox(
                      `<span style="font-size:11px;color:#94a3b8">Cargando foto…</span>`,
                    ) + infoHtml,
            )
            .addTo(mapa);

          if (!fotoPedida) {
            fotoPedida = true;
            import("@/lib/imagenes")
              .then(({ fotoDeLugar }) =>
                fotoDeLugar(nombreLoc, "", l.coord, l.wd).then((f) => {
                  fotoUrl = f?.url || null;
                  try {
                    if (popup && popup.isOpen()) {
                      popup.setHTML(
                        (fotoUrl
                          ? fotoBox(
                              `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover" alt="">`,
                            )
                          : "") + infoHtml,
                      );
                    }
                  } catch {}
                }),
              )
              .catch(() => {
                try {
                  if (popup && popup.isOpen()) popup.setHTML(infoHtml);
                } catch {}
              });
          }
        });

        el.addEventListener("mouseleave", () => {
          mapa._descongelarRotacion?.();
          if (popup) {
            popup.remove();
            popup = null;
          }
        });

        if (onClicLugar) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onClicLugar(l);
          });
        }

        markersRef.current.push(marker);
        puntos.push([l.coord[1], l.coord[0]]);
      });

      if (hospedaje?.lat != null) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:#7c3aed;width:32px;height:32px;border-radius:50% 50% 50% 4px;
          display:flex;align-items:center;justify-content:center;font-size:15px;
          border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)">🏨</div>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([hospedaje.lon, hospedaje.lat])
          .addTo(mapa);

        let popup = null;
        el.addEventListener("mouseenter", () => {
          mapa._congelarRotacion?.();
          popup = new maplibregl.Popup({
            offset: 15,
            closeButton: false,
            closeOnClick: false,
          })
            .setLngLat([hospedaje.lon, hospedaje.lat])
            .setHTML(
              `<div style="font-weight:800;font-size:12.5px;color:#052b28">🏨 ${hospedaje.nombre}</div>
              <div style="font-size:11px;color:#64748b">Tu ruta arranca aquí cada día</div>`,
            )
            .addTo(mapa);
        });
        el.addEventListener("mouseleave", () => {
          mapa._descongelarRotacion?.();
          popup?.remove();
          popup = null;
        });

        markersRef.current.push(marker);
        puntos.push([hospedaje.lon, hospedaje.lat]);
      }

      const gpsCerca =
        ubicacionUsuario && centro && !lejos(ubicacionUsuario, centro);
      if (gpsCerca) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="background:#16a34a;width:18px;height:18px;border-radius:50%;
          border:3px solid #fff;box-shadow:0 0 0 4px rgba(22,163,74,.3)"></div>`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ubicacionUsuario[1], ubicacionUsuario[0]])
          .addTo(mapa);
        markersRef.current.push(marker);
        puntos.push([ubicacionUsuario[1], ubicacionUsuario[0]]);
      }

      if (puntos.length > 1) {
        const rutaCoords = [
          ...(hospedaje?.lat != null
            ? [[hospedaje.lon, hospedaje.lat]]
            : []),
          ...lugares.map((l) => [l.coord[1], l.coord[0]]),
        ];

        const addRoute = () => {
          try {
            mapa.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: { type: "LineString", coordinates: rutaCoords },
              },
            });
            mapa.addLayer({
              id: "route-shadow",
              type: "line",
              source: "route",
              paint: {
                "line-color": "#000",
                "line-width": 6,
                "line-opacity": 0.12,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            });
            mapa.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              paint: {
                "line-color": color,
                "line-width": 4,
                "line-opacity": 0.85,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            });
          } catch {}
        };

        if (mapa.isStyleLoaded()) addRoute();
        else mapa.once("style.load", addRoute);
      }

      if (rutaTrazada?.coords?.length > 1) {
        const addRuta = () => {
          try {
            mapa.addSource("ruta-trazada", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: rutaTrazada.coords.map((c) => [c[1], c[0]]),
                },
              },
            });
            mapa.addLayer({
              id: "ruta-trazada",
              type: "line",
              source: "ruta-trazada",
              paint: {
                "line-color": "#ea580c",
                "line-width": 5,
                "line-opacity": 0.85,
              },
              layout: { "line-cap": "round", "line-join": "round" },
            });
            const bounds = new maplibregl.LngLatBounds();
            rutaTrazada.coords.forEach((c) => bounds.extend([c[1], c[0]]));
            mapa.fitBounds(bounds, { padding: 80 });
          } catch {}
        };
        if (mapa.isStyleLoaded()) addRuta();
        else mapa.once("style.load", addRuta);
      }

      // Posicionamiento de cámara
      if (esNuevo && primeraCarga.current) {
        primeraCarga.current = false;
        const doFly = () => {
          if (cancelado) return;
          setTimeout(() => {
            if (puntos.length > 1) {
              const bounds = new maplibregl.LngLatBounds();
              puntos.forEach((p) => bounds.extend(p));
              const c = bounds.getCenter();
              mapa.flyTo({
                center: [c.lng, c.lat],
                zoom: 13,
                duration: 2500,
                essential: true,
              });
            } else {
              mapa.flyTo({
                center: [centro[1], centro[0]],
                zoom: 13,
                duration: 2500,
                essential: true,
              });
            }
          }, 500);
        };
        if (mapa.loaded()) doFly();
        else mapa.once("load", doFly);
        centroAnterior.current = centro;
      } else if (!esNuevo) {
        const centroCambio =
          centro &&
          (!centroAnterior.current ||
            centroAnterior.current[0] !== centro[0] ||
            centroAnterior.current[1] !== centro[1]);

        if (centroCambio) {
          mapa.flyTo({
            center: [centro[1], centro[0]],
            zoom: 13,
            duration: 1500,
          });
          centroAnterior.current = centro;
        } else if (puntos.length > 1) {
          try {
            const bounds = new maplibregl.LngLatBounds();
            puntos.forEach((p) => bounds.extend(p));
            mapa.fitBounds(bounds, { padding: 60, maxZoom: 16 });
          } catch {}
        } else if (puntos.length === 1) {
          mapa.flyTo({ center: puntos[0], zoom: 14, duration: 800 });
        }
      }

      setTimeout(() => {
        try { mapa.resize(); } catch {}
      }, 100);
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [
    centro,
    lugares,
    ubicacionUsuario,
    hospedaje,
    rutaTrazada,
    lang,
    colorDia,
    !!onClicMapa,
  ]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", height: "100%", minHeight: 240, zIndex: 1 }}
    />
  );
}
