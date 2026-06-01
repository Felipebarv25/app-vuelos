"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { idiomaInicial, traductor } from "./idiomas";

// Contexto global: idioma + usuario (login ligero) + utilidades.
// Todo se guarda en localStorage, así no necesitamos servidor ni base de datos.
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState("es");
  const [usuario, setUsuario] = useState(null);
  const [listo, setListo] = useState(false);

  // Cargar idioma y usuario guardados al iniciar.
  useEffect(() => {
    setLang(idiomaInicial());
    try {
      const u = localStorage.getItem("usuario");
      if (u) setUsuario(JSON.parse(u));
    } catch {}
    setListo(true);
  }, []);

  function cambiarIdioma(nuevo) {
    setLang(nuevo);
    try {
      localStorage.setItem("idioma", nuevo);
    } catch {}
  }

  function entrar(nombre) {
    const u = { nombre: nombre.trim() || "Viajero", desde: Date.now() };
    setUsuario(u);
    try {
      localStorage.setItem("usuario", JSON.stringify(u));
    } catch {}
  }

  function salir() {
    setUsuario(null);
    try {
      localStorage.removeItem("usuario");
    } catch {}
  }

  const t = traductor(lang);

  return (
    <Ctx.Provider
      value={{ lang, cambiarIdioma, t, usuario, entrar, salir, listo }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp debe usarse dentro de AppProvider");
  return v;
}
