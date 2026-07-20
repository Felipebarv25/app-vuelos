// Set de íconos SVG (estilo Lucide, trazo uniforme) — reemplaza a los emojis de
// la UI para una apariencia profesional y consistente en todos los sistemas.
// Uso: <Icono nombre="star" size={20} className="..." />
const PATHS = {
  // Acciones / navegación
  wallet: (<><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></>),
  arrowRight: (<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>),
  home: (<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>),
  search: (<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  x: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  share: (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>),
  bookmark: (<><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></>),
  camera: (<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>),
  refresh: (<><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>),
  map: (<><path d="M14.1 4.1 9 2 3.6 3.8a1 1 0 0 0-.6.9v14.5a.5.5 0 0 0 .7.5L9 18l6 2 5.4-1.8a1 1 0 0 0 .6-.9V2.8a.5.5 0 0 0-.7-.5L15 4" /><path d="M9 2v16" /><path d="M15 4v16" /></>),
  pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  compass: (<><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2.9 6.3-6.3 2.9 2.9-6.3z" /></>),
  play: (<><path d="m6 4 14 8-14 8z" /></>),
  check: (<><path d="M20 6 9 17l-5-5" /></>),
  trash: (<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  plus: (<><path d="M5 12h14" /><path d="M12 5v14" /></>),
  heart: (<><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" /></>),
  // Categorías
  star: (<><path d="m12 2 3 6.3 6.9 1-5 4.9 1.2 6.8L12 18l-6.1 3 1.2-6.8-5-4.9 6.9-1z" /></>),
  image: (<><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>),
  landmark: (<><path d="M3 22h18" /><path d="M6 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="M4 11h16" /><path d="m12 2 8 6H4z" /></>),
  trees: (<><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><path d="M7 16v6" /><path d="M13 19v3" /><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" /></>),
  trophy: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  utensils: (<><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>),
  coffee: (<><path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /></>),
  wine: (<><path d="M8 22h8" /><path d="M7 10h10" /><path d="M12 15v7" /><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-1-6H8c-.5 2-1 4-1 6a5 5 0 0 0 5 5Z" /></>),
  mountain: (<><path d="m8 3 4 8 5-5 5 15H2L8 3z" /></>),
  // Datos del país / requisitos
  shield: (<><path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>),
  languages: (<><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></>),
  car: (<><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>),
  phone: (<><path d="M13.8 19.8a17 17 0 0 1-7.6-7.6c-.4-.7-.5-1.5-.3-2.3l.7-2.1a1.5 1.5 0 0 0-.4-1.6L4.6 4.4a1.5 1.5 0 0 0-2.2.2A4 4 0 0 0 2 7.3 15 15 0 0 0 16.7 22a4 4 0 0 0 2.7-.4 1.5 1.5 0 0 0 .2-2.2l-1.8-1.4a1.5 1.5 0 0 0-1.6-.4l-2.4.6Z" /></>),
  plug: (<><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></>),
  cloudSun: (<><path d="M12 2v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="M2 12h2" /><path d="M18 5a3 3 0 0 0-2.8 2" /><path d="m19.1 4.9-1.4 1.4" /><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /></>),
  droplet: (<><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z" /></>),
  banknote: (<><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></>),
  syringe: (<><path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" /><path d="m9 11 4 4" /><path d="m5 19-3 3" /><path d="m14 4 6 6" /></>),
  alert: (<><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
  // Fechas / config
  calendar: (<><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>),
  bell: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  music: (<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>),
  bag: (<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: (<><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></>),
  planeTakeoff: (<><path d="M2 22h20" /><path d="M6.4 17.4 22 13c-.5-1.9-2.5-3-4.4-2.5l-3.3.9-5.4-5.2-1.9.5 3.2 5.6-3.6 1-1.4-1.1-1.5.4z" /></>),
  planeLanding: (<><path d="M2 22h20" /><path d="M3.8 15.6 22 17c0-2-1.4-3.7-3.4-4l-3.4-.5-3-6.8-1.9-.5.5 6.4-4-.6-1-1.6-1.5.4z" /></>),
  // Viaje / afiliados
  plane: (<><path d="M17.8 19.8 22 8.9c.4-1.1-.7-2.2-1.8-1.8l-3.6 1.4-4.2-4.1c-.4-.4-1-.5-1.4-.2-.5.3-.6.9-.4 1.4l1.8 5.3-4 1.5L3 11.4l-1.5.6 2 4.9 4.9 2 .6-1.5-1.4-2.8 1.5-4 5.3 1.8c.5.2 1.1 0 1.4-.4z" /></>),
  ticket: (<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></>),
  bed: (<><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></>),
  luggage: (<><path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2" /><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" /><circle cx="8" cy="20" r="1" /><circle cx="16" cy="20" r="1" /></>),
  flame: (<><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.5-4.3 1-6-.2 2 1.3 3.8 3 5 1.5 1 2 2.5 2 4a4 4 0 1 1-8 0c0-.6.2-1.1.5-1.5z" /></>),
  chevronUp: (<path d="m18 15-6-6-6 6" />),
  chevronDown: (<path d="m6 9 6 6 6-6" />),
  zap: (<path d="M13 2 3 14h9l-1 8 10-12h-9z" />),
  // Stats / transporte genérico
  footprints: (<><path d="M4 16v-2.4c0-1 .2-2 .8-2.9.5-.9.5-1.8.4-2.8L5 6c-.1-1.1.7-2 1.8-2 .9 0 1.7.7 1.9 1.6l.4 2.1c.2.9.2 1.9 0 2.8L8.8 14c-.2 1-.6 1.5-1.6 1.5H6c-1 0-1.8-.4-2-1.5" /><path d="M20 20v-2.4c0-1-.2-2-.8-2.9-.5-.9-.5-1.8-.4-2.8l.2-1.3c.1-1.1-.7-2-1.8-2-.9 0-1.7.7-1.9 1.6l-.4 2.1c-.2.9-.2 1.9 0 2.8l.3 3c.2 1 .6 1.5 1.6 1.5H18c1 0 1.8-.4 2-1.5" /></>),
  route: (<><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>),
  sliders: (<><path d="M4 6h11M19 6h1M4 12h1M9 12h11M4 18h7M15 18h5" /><circle cx="17" cy="6" r="2" /><circle cx="7" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>),
  // Feedback / comunicación
  send: (<><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>),
  messageSquare: (<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>),
};

// Nombre de ícono según el tipo de lugar (museo, restaurante, parque…).
export function iconoCategoria(cat = "") {
  const c = (cat || "").toLowerCase();
  if (c.includes("muse") || c.includes("galer")) return "image";
  if (c.includes("restaur")) return "utensils";
  if (c.includes("caf")) return "coffee";
  if (c.includes("bar") || c.includes("pub") || c.includes("disco")) return "wine";
  if (c.includes("mirad") || c.includes("viewpoint")) return "mountain";
  if (c.includes("parq") || c.includes("park") || c.includes("jard")) return "trees";
  if (c.includes("estad")) return "trophy";
  if (
    c.includes("castil") || c.includes("castle") || c.includes("fort") || c.includes("palac") ||
    c.includes("monu") || c.includes("memor") || c.includes("igle") || c.includes("church") ||
    c.includes("templ") || c.includes("mosq") || c.includes("catedral") || c.includes("bas")
  )
    return "landmark";
  return "pin";
}

export function Icono({ nombre, size = 20, className = "", strokeWidth = 2 }) {
  const p = PATHS[nombre];
  if (!p) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {p}
    </svg>
  );
}
