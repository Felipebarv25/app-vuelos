"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { LogoMarca } from "./Logo";
import MenuUsuario from "./MenuUsuario";
import SelectorIdioma from "./SelectorIdioma";

// Header compartido por TODAS las rutas internas. Replica el patron visual
// del top del home
// pero SIN el hero — fondo blanco, sticky, mas compacto.
// `active` resalta el link de la seccion actual.
export default function NavTop({ active = null }) {
  const { t, darkMode, toggleDark, pro } = useApp();
  const pathname = usePathname() || "/";
  const router = useRouter();

  // El listado multiparada de /mis-viajes vive en un archivo grande que no
  // debemos reescribir solo para cambiar una accion de navegacion. Este
  // puente intercepta unicamente el boton "Abrir viaje" de las tarjetas <li>
  // guardadas y lo lleva al dashboard canonico. Los borradores usan otro texto
  // y los viajes de ciudad viven en <article>, asi que no quedan afectados.
  useEffect(() => {
    if (pathname !== "/mis-viajes") return;

    let vivo = true;
    const controlador = new AbortController();

    async function abrirRutaGuardada(event) {
      const boton = event.target?.closest?.("button");
      if (!boton) return;
      const texto = (boton.textContent || "").trim().toLowerCase();
      if (!texto || (!texto.includes("abrir viaje") && !texto.includes("open trip"))) return;

      const li = boton.closest("li");
      if (!li) return;

      const lista = boton.closest("ul");
      if (!lista) return;

      const tarjetas = [...lista.querySelectorAll("li")].filter((x) => {
        const b = [...x.querySelectorAll("button")].find((y) => {
          const tx = (y.textContent || "").trim().toLowerCase();
          return tx.includes("abrir viaje") || tx.includes("open trip");
        });
        return Boolean(b);
      });
      const indice = tarjetas.indexOf(li);
      if (indice < 0) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        const headers = { "Content-Type": "application/json" };
        try {
          const token =
            localStorage.getItem("anduve_auth_token") ||
            sessionStorage.getItem("anduve_auth_token");
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {}

        const r = await fetch("/api/rutas", {
          headers,
          signal: controlador.signal,
        });
        const data = r.ok ? await r.json() : null;
        const rutas = Array.isArray(data?.rutas) ? data.rutas : [];
        const ruta = rutas[indice];
        if (!vivo || !ruta?.id) return;
        router.push(`/mi-viaje?id=${encodeURIComponent(ruta.id)}`);
      } catch {}
    }

    document.addEventListener("click", abrirRutaGuardada, true);
    return () => {
      vivo = false;
      controlador.abort();
      document.removeEventListener("click", abrirRutaGuardada, true);
    };
  }, [pathname, router]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-3 py-2.5 lg:px-6">
        <Link href="/" className="flex items-center" aria-label="Anduve — inicio">
          <LogoMarca size={48} tono="marca" />
        </Link>

        {/* Nav central */}
        <nav className="hidden items-center gap-1 md:flex">
          {/* Descubre abre la barra: es la entrada para quien NO sabe a
              donde ir, que es casi todo el mundo. Destinos, que pide saber
              el destino, queda detras. */}
          <NavLink href="/descubrir" active={active === "descubrir"}>{t("navDescubre")}</NavLink>
          <NavLink href="/destino" active={active === "destinos"}>{t("navDestinos")}</NavLink>
          <NavLink href="/ofertas" active={active === "ofertas"}>{t("navOfertas")}</NavLink>
          {/* Mi viaje va ANTES que Mi ruta y Mis viajes, y no al final:
              es el centro del producto, no una pantalla mas. Hasta ahora no
              estaba en la navegacion —se llegaba solo pulsando "Abrir"
              dentro de /mis-viajes—, que es justo lo contrario de lo que
              queremos decir. */}
          <NavLink href="/mi-viaje" active={active === "miviaje"}>{t("navMiViaje")}</NavLink>
          <NavLink href="/ruta" active={active === "ruta"}>{t("navRuta")}</NavLink>
          <NavLink href="/mis-viajes" active={active === "misviajes"}>{t("navMisViajes")}</NavLink>
        </nav>

        {/* Cluster derecho */}
        <div className="flex items-center gap-2 lg:gap-3">
          {!pro && (
            <Link
              href="/pro"
              className="hidden text-[13px] font-bold text-amber-600 underline-offset-2 hover:underline sm:inline dark:text-amber-400"
            >
              ★ Hazte Pro
            </Link>
          )}
          <MenuUsuario />
          <button
            type="button"
            onClick={toggleDark}
            aria-label={darkMode ? "Modo claro" : "Modo oscuro"}
            title={darkMode ? "Modo claro" : "Modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[17px] text-slate-600 transition hover:border-marca-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <SelectorIdioma />
        </div>
      </div>

      {/* Nav mobile removida 2026-06-25: BottomTabBar component lo reemplaza
          con un patron nativo de tab bar fijo abajo. Mas usable que el strip
          de scroll horizontal que estaba aqui. */}
    </header>
  );
}

function NavLink({ href, active, children, compact = false }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md font-medium transition ${
        compact ? "px-2.5 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13.5px]"
      } ${
        active
          ? "bg-marca-50 text-marca-800 dark:bg-marca-900/40 dark:text-marca-200"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}
