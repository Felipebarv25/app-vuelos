"use client";
import { useEffect, useRef } from "react";

// Mapa Leaflet (OpenStreetMap). Recibe lugares con {coord, nombre} y dibuja
// marcadores numerados + una línea que une la ruta del día.
export default function Mapa({ centro, lugares = [], ubicacionUsuario = null }) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const capaRef = useRef([]);

  useEffect(() => {
    let L;
    let cancelado = false;

    async function init() {
      L = (await import("leaflet")).default;
      if (cancelado) return;

      if (!mapaRef.current) {
        mapaRef.current = L.map(ref.current, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapaRef.current);
      }
      const mapa = mapaRef.current;

      // Limpiar capas previas
      capaRef.current.forEach((c) => mapa.removeLayer(c));
      capaRef.current = [];

      const puntos = [];
      lugares.forEach((l, i) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#2563eb;color:#fff;width:28px;height:28px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;
            border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker(l.coord, { icon }).addTo(mapa);
        m.bindPopup(`<b>${i + 1}. ${l.nombre}</b><br>${l.categoria || ""}`);
        capaRef.current.push(m);
        puntos.push(l.coord);
      });

      // Marcador del usuario (GPS)
      if (ubicacionUsuario) {
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

      if (puntos.length > 1) {
        const linea = L.polyline(
          lugares.map((l) => l.coord),
          { color: "#2563eb", weight: 3, opacity: 0.5, dashArray: "6,8" }
        ).addTo(mapa);
        capaRef.current.push(linea);
        try {
          mapa.fitBounds(L.latLngBounds(puntos).pad(0.18));
        } catch {}
      } else if (centro) {
        mapa.setView(centro, 13);
      }
    }

    init();
    return () => {
      cancelado = true;
    };
  }, [centro, lugares, ubicacionUsuario]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", height: "100%", minHeight: 240, zIndex: 1 }}
    />
  );
}
