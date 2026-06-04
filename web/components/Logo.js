// Logo de marca: un anillo de "ruta" (concepto 360) con un pin de lugar.
// Usa currentColor, así adopta el color del contexto (blanco sobre foto, teal
// sobre fondo claro). Reemplaza al emoji 🌍.
export function Logo({ size = 28, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Anillo de ruta (360°) */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2.6 4.2"
        opacity="0.55"
      />
      {/* Pin de lugar */}
      <path
        d="M16 8.4c-3.1 0-5.6 2.5-5.6 5.6 0 3.9 5.6 9.4 5.6 9.4s5.6-5.5 5.6-9.4c0-3.1-2.5-5.6-5.6-5.6Z"
        fill="currentColor"
      />
      <circle cx="16" cy="13.9" r="2.05" fill="#fff" />
    </svg>
  );
}

// Logo + nombre, para cabeceras. `tono`: 'claro' (texto blanco) | 'marca' (teal).
export function LogoMarca({ tono = "marca", size = 26, className = "" }) {
  const color = tono === "claro" ? "text-white" : "text-marca-600";
  return (
    <span className={`inline-flex items-center gap-2 ${color} ${className}`}>
      <Logo size={size} />
      <span className="font-display text-[20px] font-bold tracking-tight lg:text-[22px]">
        Viajero <span className="text-acento-500">360</span>
      </span>
    </span>
  );
}
