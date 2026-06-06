"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { idiomaInicial, traductor } from "./idiomas";

// Contexto global: idioma + usuario (login Google o ligero) + utilidades.
//
// Dos formas de "estar logueado":
//   · GOOGLE (NextAuth): si hay session, usuario = {nombre, email, foto, google:true}.
//   · LIGERO (localStorage): si el usuario solo escribió su nombre en Bienvenida.
// Si hay sesión Google, mande Google. Si no, intenta el local. Esto permite
// estrenar Google sin romper a quienes ya entraron solo con nombre.
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const { data: session, status } = useSession();
  const [lang, setLang] = useState("es");
  const [usuarioLocal, setUsuarioLocal] = useState(null);
  const [listoLocal, setListoLocal] = useState(false);

  // Cargar idioma y usuario LOCAL guardados al iniciar.
  useEffect(() => {
    setLang(idiomaInicial());
    try {
      const u = localStorage.getItem("usuario");
      if (u) setUsuarioLocal(JSON.parse(u));
    } catch {}
    setListoLocal(true);
  }, []);

  function cambiarIdioma(nuevo) {
    setLang(nuevo);
    try {
      localStorage.setItem("idioma", nuevo);
    } catch {}
  }

  // Login LIGERO (sin Google): solo nombre en localStorage.
  function entrar(nombre) {
    const u = { nombre: nombre.trim() || "Viajero", desde: Date.now() };
    setUsuarioLocal(u);
    try {
      localStorage.setItem("usuario", JSON.stringify(u));
    } catch {}
  }

  // Login GOOGLE: redirige a /api/auth/signin/google.
  function entrarGoogle() {
    signIn("google");
  }

  // Salir: cierra Google si lo hay, y limpia el local.
  function salir() {
    if (session) signOut({ callbackUrl: "/" });
    setUsuarioLocal(null);
    try {
      localStorage.removeItem("usuario");
    } catch {}
  }

  // Usuario unificado: Google prevalece sobre local.
  const usuario = session?.user
    ? {
        nombre: session.user.name || "Viajero",
        email: session.user.email || null,
        foto: session.user.image || null,
        google: true,
      }
    : usuarioLocal;

  // "listo" significa que ya sabemos el estado real de autenticación. Esperamos
  // a que NextAuth termine de chequear (status !== "loading") y a que el local
  // haya cargado.
  const listo = listoLocal && status !== "loading";

  const t = traductor(lang);

  return (
    <Ctx.Provider
      value={{ lang, cambiarIdioma, t, usuario, entrar, entrarGoogle, salir, listo }}
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
