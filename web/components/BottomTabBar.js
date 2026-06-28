"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Tab bar fijo abajo SOLO en mobile (md:hidden). Patron de navegacion nativo
// que los usuarios de apps esperan: ya no tienen que abrir el menu hamburguesa
// ni scrollear hasta arriba para cambiar de seccion.
//
// 4 tabs: Inicio (/) · Destinos (/destino) · Ofertas (/ofertas) · Mis viajes
// (/mis-viajes). Activo se resalta en color marca. usePathname detecta la
// ruta actual. Para subpaths (/destino/madrid-espana) tambien marca activo
// el padre (/destino).

const TABS = [
  { href: "/",            label: "Inicio",    icono: "home" },
  { href: "/destino",     label: "Destinos",  icono: "globe" },
  { href: "/ofertas",     label: "Ofertas",   icono: "plane" },
  { href: "/mis-viajes",  label: "Mis viajes", icono: "bookmark" },
];

function esActivo(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomTabBar() {
  const pathname = usePathname() || "/";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md print:hidden md:hidden dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Navegación principal"
    >
      <div className="flex">
        {TABS.map((t) => {
          const activo = esActivo(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold transition ${
                activo
                  ? "text-marca-700 dark:text-marca-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              <TabIcono nombre={t.icono} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabIcono({ nombre }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (nombre === "home") return <svg {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>;
  if (nombre === "globe") return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
  if (nombre === "plane") return <svg {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>;
  if (nombre === "bookmark") return <svg {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>;
  return null;
}
