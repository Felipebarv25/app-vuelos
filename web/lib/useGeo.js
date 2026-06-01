"use client";
import { useEffect, useRef, useState } from "react";

// Hook de geolocalización en vivo. Sigue la posición del usuario (GPS) y
// la expone para calcular cuán cerca/lejos está del próximo punto.
export function useGeo(activo) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);

  useEffect(() => {
    if (!activo) {
      if (watchId.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setError("Tu dispositivo no permite GPS.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setError(null);
      },
      (e) => setError(e.message || "No se pudo obtener tu ubicación."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [activo]);

  return { pos, error };
}
