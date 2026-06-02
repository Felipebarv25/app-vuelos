"use client";
import { useEffect, useRef } from "react";

// Distancia simple en grados (para decidir si el GPS está cerca de la ciudad).
function lejos(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.6; // ~60 km
}

// Mapa Leaflet (OpenStreetMap). Recibe lugares con {coord, nombre} y dibuja
// marcadores numerados + una línea que une la ruta del día.
export default function Mapa({
  centro,
  lugares = [],
  ubicacionUsuario = null,
  rutaTrazada = null,
  onClicLugar = null,
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
        m.bindPopup(
          `<b>${i + 1}. ${l.nombre}</b><br>${l.categoria || ""}<br>
           <span style="color:#4f46e5;font-weight:600">Toca el pin para ver detalles →</span>`
        );
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
  }, [centro, lugares, ubicacionUsuario, rutaTrazada]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", height: "100%", minHeight: 240, zIndex: 1 }}
    />
  );
}
