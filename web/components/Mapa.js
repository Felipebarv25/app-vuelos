"use client";
import { useEffect, useRef } from "react";
import { nombreLocalizado } from "@/lib/nombres";

// Distancia simple en grados (para decidir si el GPS está cerca de la ciudad).
function lejos(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.6; // ~60 km
}

// Carga el CSS de Leaflet SOLO cuando se necesita un mapa (no en cada página).
// Antes estaba en el <head> y bloqueaba el render del inicio aunque ahí no haya mapa.
function asegurarCssLeaflet() {
  if (typeof document === "undefined") return;
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

// Mapa Leaflet (OpenStreetMap). Recibe lugares con {coord, nombre} y dibuja
// marcadores numerados + una línea que une la ruta del día.
export default function Mapa({
  centro,
  lugares = [],
  ubicacionUsuario = null,
  rutaTrazada = null,
  onClicLugar = null,
  lang = "es",
}) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef([]);
  const rutaRef = useRef(null);
  const centroAnterior = useRef(null);

  useEffect(() => {
    let L;
    let cancelado = false;

    async function init() {
      asegurarCssLeaflet();
      L = (await import("leaflet")).default;
      if (cancelado || !ref.current) return;

      if (!mapaRef.current) {
        mapaRef.current = L.map(ref.current, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapaRef.current);
      }
      const mapa = mapaRef.current;

      // ¿Cambió la ciudad? Si el centro es nuevo, recentramos SIEMPRE ahí.
      // Esto evita que el mapa se quede mostrando la ciudad anterior.
      const centroCambio =
        centro &&
        (!centroAnterior.current ||
          centroAnterior.current[0] !== centro[0] ||
          centroAnterior.current[1] !== centro[1]);
      if (centroCambio) {
        mapa.setView(centro, 13);
        centroAnterior.current = centro;
      }

      // Limpiar capas previas (marcadores y líneas).
      capaRef.current.forEach((c) => mapa.removeLayer(c));
      capaRef.current = [];

      const puntos = [];
      lugares.forEach((l, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#4f46e5;color:#fff;width:28px;height:28px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;
            border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker(l.coord, { icon }).addTo(mapa);
        // HOVER preview CON FOTO (feedback 2026-07-11): pasar el mouse sobre
        // el punto muestra mini-card con la foto del lugar sin clic. La foto
        // se carga perezosa al primer hover (usa la misma cascada cacheada
        // Wikipedia -> Commons -> geo -> calle de fotoDeLugar) y se inyecta
        // en el tooltip abierto. El clic sigue abriendo el detalle completo.
        const nombreLoc = nombreLocalizado(l, lang);
        const infoHtml =
          `<div style="font-weight:800;font-size:13px;color:#052b28">${i + 1}. ${nombreLoc}</div>
           <div style="font-size:11.5px;color:#64748b;margin-top:1px">${l.categoria || ""}${l.minutos ? ` · ~${l.minutos} min` : ""}${l.wiki ? " · ★ famoso" : ""}</div>
           <div style="font-size:10.5px;color:#4f46e5;font-weight:600;margin-top:2px">Clic para detalles y cómo llegar</div>`;
        const fotoBox = (inner) =>
          `<div style="width:210px;height:110px;border-radius:9px;overflow:hidden;background:#e2e8f0;margin-bottom:6px;display:flex;align-items:center;justify-content:center">${inner}</div>`;
        m.bindTooltip(infoHtml, {
          direction: "top", offset: [0, -12], opacity: 1, sticky: false, className: "anduve-tooltip",
        });
        let fotoPedida = false;
        m.on("mouseover", () => {
          if (fotoPedida) return;
          fotoPedida = true;
          // Skeleton mientras llega la foto; luego se reemplaza en caliente.
          m.setTooltipContent(fotoBox(`<span style="font-size:11px;color:#94a3b8">Cargando foto…</span>`) + infoHtml);
          import("@/lib/imagenes").then(({ fotoDeLugar }) =>
            fotoDeLugar(nombreLoc, "", l.coord, l.wd).then((f) => {
              m.setTooltipContent(
                (f?.url
                  ? fotoBox(`<img src="${f.url}" style="width:100%;height:100%;object-fit:cover" alt="">`)
                  : "") + infoHtml
              );
            })
          ).catch(() => m.setTooltipContent(infoHtml));
        });
        if (onClicLugar) m.on("click", () => onClicLugar(l));
        capaRef.current.push(m);
        puntos.push(l.coord);
      });

      // Marcador del usuario (GPS) — solo se DIBUJA si está cerca de la ciudad.
      const gpsCerca =
        ubicacionUsuario && centro && !lejos(ubicacionUsuario, centro);
      if (gpsCerca) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#16a34a;width:18px;height:18px;border-radius:50%;
            border:3px solid #fff;box-shadow:0 0 0 4px rgba(22,163,74,.3)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const m = L.marker(ubicacionUsuario, { icon }).addTo(mapa);
        m.bindPopup("📍 Tú estás aquí");
        capaRef.current.push(m);
        puntos.push(ubicacionUsuario);
      }

      // Encuadre: ajustamos a los puntos (lugares + GPS cercano). El GPS lejano
      // ya quedó excluido, así que el mapa nunca se va a otra ciudad/país.
      if (puntos.length > 1) {
        const linea = L.polyline(
          lugares.map((l) => l.coord),
          { color: "#4f46e5", weight: 3, opacity: 0.5, dashArray: "6,8" }
        ).addTo(mapa);
        capaRef.current.push(linea);
        try {
          mapa.fitBounds(L.latLngBounds(puntos).pad(0.18));
        } catch {}
      } else if (puntos.length === 1) {
        mapa.setView(puntos[0], 14);
      }
      // Si no hay puntos, ya recentramos en la ciudad arriba (centroCambio).

      // Ruta trazada (camino real entre el usuario y un lugar).
      if (rutaRef.current) {
        mapa.removeLayer(rutaRef.current);
        rutaRef.current = null;
      }
      if (rutaTrazada?.coords?.length > 1) {
        rutaRef.current = L.polyline(rutaTrazada.coords, {
          color: "#ea580c",
          weight: 5,
          opacity: 0.85,
        }).addTo(mapa);
        try {
          mapa.fitBounds(L.latLngBounds(rutaTrazada.coords).pad(0.25));
        } catch {}
      }

      // Recalcular tamaño (evita el mapa "roto"/gris al cambiar de vista).
      setTimeout(() => {
        try {
          mapa.invalidateSize();
        } catch {}
      }, 100);
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [centro, lugares, ubicacionUsuario, rutaTrazada, lang]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", height: "100%", minHeight: 240, zIndex: 1 }}
    />
  );
}
