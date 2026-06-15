"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";
import { Logo } from "@/components/Logo";

// Pantalla de bienvenida: idioma + autenticacion (Google si esta configurado,
// magic code por email si Resend esta listo, o nombre ligero como fallback
// que SIEMPRE funciona). Se muestra solo la primera vez.
export default function Bienvenida() {
  const {
    t,
    lang,
    cambiarIdioma,
    entrar,
    entrarGoogle,
    pedirCodigoEmail,
    verificarCodigoEmail,
  } = useApp();

  const [nombre, setNombre] = useState("");

  // Auth config: que metodos estan disponibles segun env vars del servidor.
  const [authConfig, setAuthConfig] = useState({ google: false, magicCode: false });
  useEffect(() => {
    fetch("/api/auth-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAuthConfig({ google: !!d.google, magicCode: !!d.magicCode }))
      .catch(() => {});
  }, []);

  // Flujo magic code: paso 1 = email, paso 2 = codigo. Se cierra si el
  // usuario aprieta "Volver".
  const [pasoMagic, setPasoMagic] = useState(0); // 0=oculto, 1=email, 2=codigo
  const [emailInput, setEmailInput] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [magicCargando, setMagicCargando] = useState(false);
  const [magicError, setMagicError] = useState(null);

  async function enviarCodigo(e) {
    e?.preventDefault();
    setMagicError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setMagicError(t("authErrorEmail"));
      return;
    }
    setMagicCargando(true);
    const r = await pedirCodigoEmail(emailInput.trim());
    setMagicCargando(false);
    if (r.ok) {
      setPasoMagic(2);
    } else {
      setMagicError(t("authErrorEnvio"));
    }
  }

  async function verificarCodigo(e) {
    e?.preventDefault();
    setMagicError(null);
    const codigo = codigoInput.replace(/\D/g, "").slice(0, 6);
    if (codigo.length !== 6) {
      setMagicError(t("authErrorCodigo"));
      return;
    }
    setMagicCargando(true);
    const r = await verificarCodigoEmail(emailInput.trim(), codigo, nombre.trim() || null);
    setMagicCargando(false);
    if (!r.ok) {
      setMagicError(t("authErrorCodigoMal"));
    }
    // Si ok, AppContext setea usuarioEmail y el modal de Bienvenida desaparece
    // (la home se renderiza porque `usuario` ya tiene valor).
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-gradient-to-br from-marca-500 via-marca-600 to-marca-900">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-[0_24px_60px_rgba(49,46,129,.45)] animar-subir">
        <div className="flex justify-center text-marca-600"><Logo size={56} /></div>
        <h1 className="text-[26px] font-bold text-marca-900 text-center tracking-tight mt-2">
          Viajero <span className="text-acento-500">360</span>
        </h1>
        <p className="text-sm text-slate-500 text-center mt-1">{t("tagline")}</p>

        {/* Selector de idioma */}
        <div className="mt-6">
          <div className="text-[13px] font-bold text-slate-600 mb-2">{t("idioma")}</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(IDIOMAS).map(([cod, info]) => (
              <button
                key={cod}
                onClick={() => cambiarIdioma(cod)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition ${
                  lang === cod
                    ? "border-marca-500 bg-marca-50 font-bold text-marca-900"
                    : "border-slate-200 bg-white font-medium text-slate-700"
                }`}
              >
                <span className={`flex h-6 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                  lang === cod ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>{cod.toUpperCase()}</span>
                {info.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Flujo magic code: si esta abierto, OCULTA todo lo demas para
            que el usuario se concentre en email -> codigo. */}
        {pasoMagic > 0 ? (
          <div className="mt-6 animar-aparecer">
            {pasoMagic === 1 && (
              <form onSubmit={enviarCodigo}>
                <div className="text-[13px] font-bold text-slate-600 mb-2">{t("authTuEmail")}</div>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-base"
                  autoFocus
                />
                {magicError && (
                  <div className="mt-2 text-[12.5px] font-semibold text-red-600">{magicError}</div>
                )}
                <button
                  type="submit"
                  disabled={magicCargando}
                  className="w-full mt-4 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca disabled:opacity-60"
                >
                  {magicCargando ? "…" : t("authEnviarCodigo")} →
                </button>
                <button
                  type="button"
                  onClick={() => { setPasoMagic(0); setMagicError(null); }}
                  className="w-full mt-2 py-2 text-[13px] font-semibold text-slate-500"
                >
                  ← {t("authVolver")}
                </button>
              </form>
            )}

            {pasoMagic === 2 && (
              <form onSubmit={verificarCodigo}>
                <div className="text-[13px] text-slate-600 mb-2">
                  {t("authMandamosCodigo")} <b className="text-marca-700">{emailInput}</b>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-marca-200 text-center text-2xl font-extrabold tracking-[0.4em] font-mono"
                  autoFocus
                />
                {/* Campo opcional: como llamamos al usuario */}
                <div className="mt-3 text-[12.5px] font-semibold text-slate-500">{t("authComoLlamamos")}</div>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Felipe…"
                  className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-base"
                />
                {magicError && (
                  <div className="mt-2 text-[12.5px] font-semibold text-red-600">{magicError}</div>
                )}
                <button
                  type="submit"
                  disabled={magicCargando}
                  className="w-full mt-4 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca disabled:opacity-60"
                >
                  {magicCargando ? "…" : t("authVerificar")} →
                </button>
                <button
                  type="button"
                  onClick={() => { setPasoMagic(1); setCodigoInput(""); setMagicError(null); }}
                  className="w-full mt-2 py-2 text-[13px] font-semibold text-slate-500"
                >
                  ← {t("authCambiarEmail")}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Boton Google solo si OAuth esta configurado */}
            {authConfig.google && (
              <button
                onClick={entrarGoogle}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 text-[15px] font-bold text-slate-700 shadow-suave transition hover:bg-slate-50"
              >
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 13.9-5.4l-6.4-5.4C29.4 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.4 5.4c-.5.4 6.5-4.7 6.5-15 0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                {t("entrarGoogle")}
              </button>
            )}

            {/* Boton "Entrar con email" — magic code via Resend */}
            {authConfig.magicCode && (
              <button
                onClick={() => setPasoMagic(1)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-marca-200 bg-marca-50 py-3 text-[15px] font-bold text-marca-700 transition hover:bg-marca-100"
              >
                ✉️ {t("authEntrarEmail")}
              </button>
            )}

            {/* Separador siempre que haya al menos un metodo "fuerte" arriba */}
            {(authConfig.google || authConfig.magicCode) && (
              <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                {t("oContinuar")}
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            )}
            {!authConfig.google && !authConfig.magicCode && <div className="mt-6" />}

            {/* Nombre (login ligero, siempre disponible como fallback) */}
            <div>
              <div className="text-[13px] font-bold text-slate-600 mb-2">{t("tuNombre")}</div>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar(nombre)}
                placeholder="Felipe…"
                className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-base"
                autoFocus={!authConfig.magicCode && !authConfig.google}
              />
            </div>

            <button
              onClick={() => entrar(nombre)}
              className="w-full mt-4 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca"
            >
              {t("comenzar")} →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
