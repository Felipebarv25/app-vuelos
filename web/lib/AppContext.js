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

  // Estado de subscripcion Pro. `null` = no consultado todavia, false = no Pro,
  // true = Pro vigente. Se carga desde /api/me cuando hay sesion (Google o
  // email) y se refresca cuando el usuario cambia. `creditos` cuenta las
  // microcompras (PDF, alerta) que el usuario tiene disponibles.
  const [pro, setPro] = useState(false);
  const [plan, setPlan] = useState(null);
  const [creditos, setCreditos] = useState({ pdf: 0, alerta: 0 });
  // Modal de paywall: { abierto, motivo }. El componente padre lo renderiza
  // viendo este estado; cualquier feature gateada llama abrirPaywall("pdf").
  const [paywall, setPaywall] = useState({ abierto: false, motivo: null });

  // Cargar idioma y usuario LOCAL guardados al iniciar.
  useEffect(() => {
    setLang(idiomaInicial());
    try {
      const u = localStorage.getItem("usuario");
      if (u) setUsuarioLocal(JSON.parse(u));
    } catch {}
    setListoLocal(true);
  }, []);

  // Validar el token de email si existe. Buscamos en localStorage primero
  // (persistente, "mantener sesion iniciada") y caemos a sessionStorage
  // (se borra cuando el usuario cierra el navegador) si no esta.
  useEffect(() => {
    let vivo = true;
    let token;
    try {
      token = localStorage.getItem("v360_auth_token")
           || sessionStorage.getItem("v360_auth_token");
    } catch {}
    if (!token) { setListoEmail(true); return; }
    fetch("/api/auth/sesion", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        if (d?.ok && d.usuario) {
          setUsuarioEmail({ ...d.usuario, token, email_login: true });
        } else {
          // Token invalido (expirado, revocado): limpiar ambos stores.
          try {
            localStorage.removeItem("v360_auth_token");
            sessionStorage.removeItem("v360_auth_token");
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => vivo && setListoEmail(true));
    return () => { vivo = false; };
  }, []);

  // Cargar/refrescar el estado Pro cuando cambia el usuario y al volver al
  // foco (el usuario puede haber comprado en otra pestana).
  useEffect(() => {
    refrescarPro();
    const onFocus = () => refrescarPro();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, [session?.user?.email, usuarioEmail?.email]);

  function cambiarIdioma(nuevo) {
    setLang(nuevo);
    try {
      localStorage.setItem("idioma", nuevo);
    } catch {}
  }

  // Refresca el estado Pro/creditos desde /api/me. Se llama cuando el usuario
  // cambia de identidad (login/logout) o cuando volvemos al foco tras un
  // checkout (el webhook puede haber actualizado KV).
  async function refrescarPro() {
    try {
      let headers = { "Content-Type": "application/json" };
      // Si tenemos token email, lo pasamos para identificar al usuario.
      try {
        const tk = localStorage.getItem("v360_auth_token");
        if (tk) headers.Authorization = `Bearer ${tk}`;
      } catch {}
      const r = await fetch("/api/me", { headers });
      if (!r.ok) return;
      const d = await r.json();
      setPro(!!d?.pro);
      setPlan(d?.plan || null);
      if (d?.creditos) setCreditos(d.creditos);
    } catch {}
  }

  // Disparador del paywall. `motivo` controla el texto contextual del modal
  // ("pdf", "guardar", "alerta", "grafico", "compartir").
  function abrirPaywall(motivo = "guardar") {
    setPaywall({ abierto: true, motivo });
  }
  function cerrarPaywall() {
    setPaywall({ abierto: false, motivo: null });
  }
  // Guardia general: si el usuario es Pro -> ejecuta accion. Si no -> abre
  // paywall con el motivo correcto. Devuelve true si ejecuto, false si gateo.
  function requierePro(motivo, accion) {
    if (pro) {
      try { accion?.(); } catch {}
      return true;
    }
    abrirPaywall(motivo);
    return false;
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
  // `recordar` controla DONDE guardamos el token:
  //   true  -> localStorage (persistente, sobrevive cierre de navegador)
  //   false -> sessionStorage (se borra al cerrar la pestana/navegador)
  // El servidor crea la sesion con TTL 30 dias en KV en ambos casos; la
  // diferencia es solo cliente. Por seguridad limpiamos el otro store.
  async function verificarCodigoEmail(email, codigo, nombre, recordar = true) {
    const r = await fetch("/api/auth/codigo/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo, nombre }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.ok || !data?.token) {
      return { ok: false, motivo: data?.motivo || "error" };
    }
    try {
      if (recordar) {
        localStorage.setItem("v360_auth_token", data.token);
        sessionStorage.removeItem("v360_auth_token");
      } else {
        sessionStorage.setItem("v360_auth_token", data.token);
        localStorage.removeItem("v360_auth_token");
      }
    } catch {}
    setUsuarioEmail({ ...data.usuario, token: data.token, email_login: true });
    return { ok: true };
  }

  // Login GOOGLE: redirige a /api/auth/signin/google.
  function entrarGoogle() {
    signIn("google");
  }

  // Login DEMO instantaneo: crea sesion para una cuenta demo predefinida sin
  // pasar por codigo email ni Google. `plan` = "pro" muestra la app con todas
  // las features Pro; `plan` = "free" la muestra con paywall normal.
  async function entrarDemo(plan = "pro") {
    const r = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data?.ok || !data?.token) return { ok: false, motivo: data?.motivo || "error" };
    try { sessionStorage.setItem("v360_auth_token", data.token); } catch {}
    setUsuarioEmail({ ...data.usuario, token: data.token, email_login: true, demo: true });
    return { ok: true };
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
      sessionStorage.removeItem("v360_auth_token");
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
        entrarDemo,
        pedirCodigoEmail,
        verificarCodigoEmail,
        salir,
        listo,
        pro,
        plan,
        creditos,
        paywall,
        abrirPaywall,
        cerrarPaywall,
        requierePro,
        refrescarPro,
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
