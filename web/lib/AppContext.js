"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const [darkMode, setDarkMode] = useState(false);
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
  // Alertas de precio del usuario. Viven aca y no en cada componente porque hay
  // dos lectores (el chip del home y el menu de usuario) y cinco escritores
  // (crear, borrar y tres sitios que editan). Antes cada lector hacia su propio
  // fetch y ningun escritor los avisaba: al crear o borrar una alerta el chip
  // del home seguia mostrando el numero viejo hasta recargar la pagina.
  // null = todavia sin cargar.
  const [alertas, setAlertas] = useState(null);
  // Modal de paywall: { abierto, motivo }. El componente padre lo renderiza
  // viendo este estado; cualquier feature gateada llama abrirPaywall("pdf").
  const [paywall, setPaywall] = useState({ abierto: false, motivo: null });

  // Cargar idioma, tema oscuro y usuario LOCAL guardados al iniciar.
  useEffect(() => {
    setLang(idiomaInicial());
    try {
      const u = localStorage.getItem("usuario");
      if (u) setUsuarioLocal(JSON.parse(u));
    } catch {}
    // Leer preferencia de modo oscuro (el script anti-FOUC ya aplicó la clase
    // al <html>; aquí sólo sincronizamos el estado React).
    try {
      const prefer = localStorage.getItem("anduve_dark");
      const prefersOS = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const esDark = prefer !== null ? prefer === "1" : prefersOS;
      setDarkMode(esDark);
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
      token = localStorage.getItem("anduve_auth_token")
           || sessionStorage.getItem("anduve_auth_token");
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
            localStorage.removeItem("anduve_auth_token");
            sessionStorage.removeItem("anduve_auth_token");
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => vivo && setListoEmail(true));
    return () => { vivo = false; };
  }, []);

  // Cargar/refrescar el estado Pro y las alertas cuando cambia el usuario y al
  // volver al foco (el usuario puede haber comprado o creado alertas en otra
  // pestana).
  useEffect(() => {
    refrescarPro();
    refrescarAlertas();
    const onFocus = () => { refrescarPro(); refrescarAlertas(); };
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

  function toggleDark() {
    const nuevo = !darkMode;
    setDarkMode(nuevo);
    try {
      localStorage.setItem("anduve_dark", nuevo ? "1" : "0");
    } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nuevo);
    }
  }

  // Refresca el estado Pro/creditos desde /api/me. Se llama cuando el usuario
  // cambia de identidad (login/logout) o cuando volvemos al foco tras un
  // checkout (el webhook puede haber actualizado KV).
  async function refrescarPro() {
    try {
      let headers = { "Content-Type": "application/json" };
      // Si tenemos token email, lo pasamos para identificar al usuario.
      // BUG FIX: leer también de sessionStorage (sesiones Demo viven ahí).
      try {
        const tk = localStorage.getItem("anduve_auth_token")
                || sessionStorage.getItem("anduve_auth_token");
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

  // Vuelve a leer las alertas del usuario. Cualquier componente que cree, borre
  // o edite una alerta debe llamar a esto al terminar, para que el contador del
  // chip del home y el del menu de usuario queden al dia sin recargar.
  async function refrescarAlertas() {
    try {
      const headers = {};
      let tk;
      try {
        tk = localStorage.getItem("anduve_auth_token")
          || sessionStorage.getItem("anduve_auth_token");
        if (tk) headers.Authorization = `Bearer ${tk}`;
      } catch {}
      // Sin sesion de Google ni token no hay a quien pedirle alertas: evitamos
      // un 401 en cada carga del landing para visitantes anonimos.
      if (!tk && !session?.user?.email) {
        setAlertas([]);
        return;
      }
      const r = await fetch("/api/alertas", { headers });
      if (!r.ok) {
        // 401 (sin sesion) o 503 (sin KV): lista vacia, no null, para que los
        // consumidores dejen de mostrar el estado "cargando".
        setAlertas([]);
        return;
      }
      const d = await r.json();
      setAlertas(d?.ok ? (d.alertas || []) : []);
    } catch {
      setAlertas([]);
    }
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
        localStorage.setItem("anduve_auth_token", data.token);
        sessionStorage.removeItem("anduve_auth_token");
      } else {
        sessionStorage.setItem("anduve_auth_token", data.token);
        localStorage.removeItem("anduve_auth_token");
      }
    } catch {}
    guardarMantener(recordar);
    setUsuarioEmail({ ...data.usuario, token: data.token, email_login: true });
    return { ok: true };
  }

  // Permiso "mantener sesion abierta" (2026-07-13): sin el, reabrir la app
  // despues de >15 min de la ultima actividad exige login de nuevo, aunque
  // la cookie de Google o el token sigan tecnicamente vivos.
  function guardarMantener(si) {
    try { localStorage.setItem("anduve_mantener", si ? "1" : "0"); } catch {}
  }

  // Login GOOGLE: redirige a /api/auth/signin/google. `recordar` = permiso
  // de mantener la sesion abierta entre visitas (se persiste ANTES del
  // redirect porque el flujo OAuth recarga la pagina).
  function entrarGoogle(recordar = true) {
    guardarMantener(recordar !== false);
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
    try { sessionStorage.setItem("anduve_auth_token", data.token); } catch {}
    setUsuarioEmail({ ...data.usuario, token: data.token, email_login: true, demo: true });
    return { ok: true };
  }

  // Salir: cierra Google + sesion email + limpia el local.
  async function salir() {
    if (session) signOut({ callbackUrl: "/" });
    // Cerrar sesion server-side del email si existe.
    let token;
    try {
      token = localStorage.getItem("anduve_auth_token")
           || sessionStorage.getItem("anduve_auth_token");
    } catch {}
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
      localStorage.removeItem("anduve_auth_token");
      sessionStorage.removeItem("anduve_auth_token");
      localStorage.removeItem("anduve_mantener");
      localStorage.removeItem("anduve_ult_act");
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

  // Auto-cierre por inactividad (pedido 2026-07-13): con sesion activa, 15 min
  // sin interaccion (mouse/teclado/touch/scroll) cierran la sesion y devuelven
  // al landing pre-login. Chequeo cada 30 s + al volver a la pestana (si
  // estuvo oculta mas de 15 min, expira de inmediato). La ultima actividad se
  // persiste en localStorage para que el mismo limite aplique al REABRIR el
  // navegador (apagar el PC no debe dejar la sesion abierta) salvo que el
  // usuario haya dado permiso de mantenerla ("anduve_mantener").
  const haySesion = !!usuario;
  const LIMITE_INACTIVIDAD = 15 * 60 * 1000;
  useEffect(() => {
    if (!haySesion) return;
    let ultima = Date.now();
    let ultimaGuardada = 0;
    let cerrando = false;
    const persistir = () => {
      // A lo sumo una escritura cada 20 s: suficiente resolucion para un
      // limite de 15 min sin castigar el hilo con cada pointermove.
      if (Date.now() - ultimaGuardada < 20000) return;
      ultimaGuardada = Date.now();
      try { localStorage.setItem("anduve_ult_act", String(ultima)); } catch {}
    };
    const marcar = () => { ultima = Date.now(); persistir(); };
    const expirar = () => {
      if (cerrando) return;
      cerrando = true;
      Promise.resolve(salir()).finally(() => {
        try { window.location.href = "/"; } catch {}
      });
    };
    const chequear = () => {
      // Con permiso explicito ("Mantener sesion iniciada") no se expira nunca
      // por inactividad — el checkbox es la palabra del usuario.
      let mantener = false;
      let ult = ultima;
      try {
        mantener = localStorage.getItem("anduve_mantener") === "1";
        // Otra pestana pudo registrar actividad mas reciente: no expirar
        // esta mientras el usuario trabaja en aquella.
        ult = Math.max(ult, Number(localStorage.getItem("anduve_ult_act") || 0));
      } catch {}
      if (!mantener && Date.now() - ult >= LIMITE_INACTIVIDAD) expirar();
      else persistir();
    };
    const evs = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    const intervalo = setInterval(chequear, 30000);
    document.addEventListener("visibilitychange", chequear);
    persistir();
    return () => {
      evs.forEach((e) => window.removeEventListener(e, marcar));
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", chequear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haySesion]);

  // Chequeo de REAPERTURA (2026-07-13): al cargar la app con una sesion viva
  // (cookie Google / token email / usuario local), si el usuario NO dio
  // permiso de mantenerla abierta y su ultima actividad registrada fue hace
  // mas de 15 min, se cierra la sesion y queda en el landing pre-login.
  const reaperturaChequeada = useRef(false);
  useEffect(() => {
    if (!listo || !haySesion || reaperturaChequeada.current) return;
    reaperturaChequeada.current = true;
    try {
      const mantener = localStorage.getItem("anduve_mantener") === "1";
      const ult = Number(localStorage.getItem("anduve_ult_act") || 0);
      // Sin registro de actividad previa no expiramos: es un login reciente
      // (el flujo OAuth recarga la pagina antes del primer "marcar").
      if (!mantener && ult && Date.now() - ult > LIMITE_INACTIVIDAD) {
        Promise.resolve(salir()).finally(() => {
          try { window.location.href = "/"; } catch {}
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, haySesion]);

  const t = traductor(lang);

  return (
    <Ctx.Provider
      value={{
        lang,
        cambiarIdioma,
        darkMode,
        toggleDark,
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
        alertas,
        refrescarAlertas,
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
