// Favoritos de destinos del usuario. Cuando hay sesión Google, se persiste
// en Vercel KV vía /api/favoritos. Sin sesión (o sin KV), se usa
// localStorage para que la experiencia siga funcionando.
"use client";
import { useEffect, useState, useCallback } from "react";

const CLAVE_LOCAL = "anduve_favoritos";

function leerLocal() {
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function escribirLocal(arr) {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(arr));
  } catch {}
}

// Hook reusable: gestiona el array de slugs favoritos del usuario actual.
// Si hay sesión Google, sincroniza con la nube. Si no, todo local.
export function useFavoritos(usuario) {
  const [slugs, setSlugs] = useState([]);
  const [listo, setListo] = useState(false);

  const sync = useCallback(async () => {
    if (usuario?.google) {
      try {
        const r = await fetch("/api/favoritos");
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d?.slugs)) {
            setSlugs(d.slugs);
            setListo(true);
            return;
          }
        }
      } catch {}
    }
    setSlugs(leerLocal());
    setListo(true);
  }, [usuario?.email, usuario?.google]);

  useEffect(() => {
    sync();
  }, [sync]);

  const toggle = useCallback(
    async (slug) => {
      const existe = slugs.includes(slug);
      const nuevos = existe ? slugs.filter((s) => s !== slug) : [...slugs, slug];
      setSlugs(nuevos); // optimistic

      if (usuario?.google) {
        try {
          const r = await fetch("/api/favoritos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, fav: !existe }),
          });
          if (r.ok) {
            const d = await r.json();
            if (Array.isArray(d?.slugs)) setSlugs(d.slugs);
            return;
          }
        } catch {}
        // Si falla la nube, persistir local como respaldo.
      }
      escribirLocal(nuevos);
    },
    [slugs, usuario?.google]
  );

  return { slugs, toggle, listo, esFav: (s) => slugs.includes(s) };
}
