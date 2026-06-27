"use client";
import { useApp } from "@/lib/AppContext";

// Footer compartido por home + rutas internas. Centraliza atribución legal
// (OSM/Wikivoyage/Wikidata/Passport Index) y enlaces de navegación a las
// landing SEO. Antes vivía inline en page.js — extraído para que /ofertas y
// /mis-viajes lo hereden y la app no se sienta "rota" al cambiar de ruta.
export default function FooterAnduve() {
  const { t } = useApp();
  return (
    <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-400 print:hidden dark:text-slate-500 lg:px-8">
      <div className="mb-3 flex flex-wrap justify-center gap-3 text-[12.5px] font-semibold text-slate-500">
        <a href="/destino" className="hover:text-marca-600 hover:underline">
          Ver 80 destinos
        </a>
        <span className="text-slate-300">·</span>
        <a href="/comparar" className="hover:text-marca-600 hover:underline">
          Comparar destinos
        </a>
        <span className="text-slate-300">·</span>
        <a href="/privacidad" className="hover:text-marca-600 hover:underline">
          Privacidad
        </a>
        <span className="text-slate-300">·</span>
        <a href="/terminos" className="hover:text-marca-600 hover:underline">
          Términos
        </a>
      </div>
      <div>{t("footer")} · Anduve</div>
      <div className="mt-1 text-[11px] text-slate-400">
        Datos de lugares: ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline hover:text-marca-600">
          OpenStreetMap
        </a>{" "}
        (ODbL) ·{" "}
        <a href="https://es.wikivoyage.org/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
          Wikivoyage
        </a>
        /{" "}
        <a href="https://www.wikidata.org/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
          Wikidata
        </a>{" "}
        (CC BY-SA) · Popularidad: Amadeus
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        Requisitos de visa:{" "}
        <a href="https://github.com/ilyankou/passport-index-dataset" target="_blank" rel="noopener" className="underline hover:text-marca-600">
          Passport Index
        </a>{" "}
        · Países:{" "}
        <a href="https://restcountries.com/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
          REST Countries
        </a>
        {" "}· Información referencial, verifica en fuentes oficiales.
      </div>
    </footer>
  );
}
