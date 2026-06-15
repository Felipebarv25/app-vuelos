"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { idiomaInicial, traductor } from "./idiomas";

// Contexto global: idioma + usuario (login Google o ligero) + utilidades.
//
// Tres formas de "estar logueado":
//   · GOOGLE (NextAuth): si hay session, usuario = {nombre, email, foto, google:true}.
//   · EMAIL (codigo + KV): se confirma con codigo de 6 digitos enviado al email.
//     Token en localStorage; perfil con gustos persistido server-side en KV.
//   · LIGERO (localStorage): si el usuario solo escribió su nombre en Bienvenida.
// Prioridad para construir el `usuario` unificado: Google > Email > Local.
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const { data: session, status } = useSession();
  const [lang, setLang] = useState("es");
  const [usuarioLocal, setUsuarioLocal] = useState(null);
  const [usuarioEmail, setUsuarioEmail] = useState(null);
  const [listoLocal, setListoLocal] = useState(false);
  const [listoEmail, setListoEmail] = useState(false);

  // Cargar idioma y usuario LOCAL guardados al iniciar.
  useEffect(() => {
    setLang(idiomaInicial());
    try {
      const u = localStorage.getItem("usuario");
      if (u) setUsuarioLocal(JSON.parse(u));
    } catch {}
    setListoLocal(true);
  }, []);

  // Validar el token de email si existe en localStorage.
  useEffect(() => {
    let vivo = true;
    let token;
    try { token = localStorage.getItem("v360_auth_token"); } catch {}
    if (!token) { setListoEmail(true); return; }
    fetch("/api/auth/sesion", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        if (d?.ok && d.usuario) {
          setUsuarioEmail({ ...d.usuario, token, email_login: true });
        } else {
          // Token invalido (expirado, revocado): limpiar.
          try { localStorage.removeItem("v360_auth_token"); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => vivo && setListoEmail(true));
    return () => { vivo = false; };
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

  // Login EMAIL paso 1: pedir codigo.
  async function pedirCodigoEmail(email) {
    const r = await fetch("/api/auth/codigo/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, lang }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: !!data?.ok, motivo: data?.motivo || (r.ok ? null : "error") };
  }

  // Login EMAIL paso 2: validar codigo, recibir token, persistir sesion.
  async function verificarCodigoEmail(email, codigo, nombre) {
    const r = await fetch("/api/auth/codigo/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo, nombre }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.ok || !data?.token) {
      return { ok: false, motivo: data?.motivo || "error" };
    }
    try { localStorage.setItem("v360_auth_token", data.token); } catch {}
    setUsuarioEmail({ ...data.usuario, token: data.token, email_login: true });
    return { ok: true };
  }

  // Login GOOGLE: redirige a /api/auth/signin/google.
  function entrarGoogle() {
    signIn("google");
  }

  // Salir: cierra Google + sesion email + limpia el local.
  async function salir() {
    if (session) signOut({ callbackUrl: "/" });
    // Cerrar sesion server-side del email si existe.
    let token;
    try { token = localStorage.getItem("v360_auth_token"); } catch {}
    if (token) {
      try {
        await fetch("/api/auth/sesion", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    setUsuarioEmail(null);
    setUsuarioLocal(null);
    try {
      localStorage.removeItem("usuario");
      localStorage.removeItem("v360_auth_token");
    } catch {}
  }

  // Usuario unificado: Google > Email > Local.
  let usuario = null;
  if (session?.user) {
    usuario = {
      nombre: session.user.name || "Viajero",
      email: session.user.email || null,
      foto: session.user.image || null,
      google: true,
    };
  } else if (usuarioEmail) {
    usuario = {
      nombre: usuarioEmail.nombre || "Viajero",
      email: usuarioEmail.email,
      foto: null,
      email_login: true,
    };
  } else if (usuarioLocal) {
    usuario = usuarioLocal;
  }

  // "listo" significa que ya sabemos el estado real de autenticación. Esperamos
  // a que NextAuth termine de chequear, a que el local haya cargado, y a que
  // el token email haya sido validado.
  const listo = listoLocal && listoEmail && status !== "loading";

  const t = traductor(lang);

  return (
    <Ctx.Provider
      value={{
        lang,
        cambiarIdioma,
        t,
        usuario,
        entrar,
        entrarGoogle,
        pedirCodigoEmail,
        verificarCodigoEmail,
        salir,
        listo,
      }}
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
