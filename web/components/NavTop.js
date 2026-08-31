"use client";
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { LogoMarca } from "./Logo";
import MenuUsuario from "./MenuUsuario";
import SelectorIdioma from "./SelectorIdioma";

// Header compartido por las rutas internas post-login (/ofertas, /mis-viajes,
// y en el futuro otras secciones). Replica el patron visual del top del home
// pero SIN el hero — fondo blanco, sticky, mas compacto.
// `active` resalta el link de la seccion actual.
export default function NavTop({ active = null }) {
  const { t, darkMode, toggleDark, pro } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-3 py-2.5 lg:px-5">
        <Link href="/" className="flex items-center" aria-label="Anduve — inicio">
          <LogoMarca size={48} tono="marca" />
        </Link>

        {/* Nav central */}
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/destino" active={active === "destinos"}>Destinos</NavLink>
          <NavLink href="/ofertas" active={active === "ofertas"}>Ofertas</NavLink>
          <NavLink href="/ruta" active={active === "ruta"}>Mi ruta</NavLink>
          <NavLink href="/mis-viajes" active={active === "misviajes"}>Mis viajes</NavLink>
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
