"use client";
// Componentes visuales reutilizables (tema "marca" indigo de Tailwind).

export function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
        activo
          ? "bg-marca-600 text-white shadow-marca"
          : "bg-white text-marca-900 ring-1 ring-slate-200 hover:ring-marca-300"
      }`}
    >
      {children}
    </button>
  );
}

export function Boton({ onClick, href, variante = "primario", children, style }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-[14.5px] font-bold transition";
  const estilos = {
    primario: "bg-gradient-to-r from-marca-500 to-marca-600 text-white shadow-marca hover:brightness-105",
    sec: "bg-white text-marca-600 ring-[1.5px] ring-marca-100 hover:bg-marca-50",
    // verde = semántico de "dinero / éxito" (GPS activo, confirmar)
    verde: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(5,150,105,.3)] hover:brightness-105",
  };
  const cls = `${base} ${estilos[variante] || estilos.primario}`;
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener" className={cls} style={style}>
        {children}
      </a>
    );
  return (
    <button onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

export function Tarjeta({ children, style }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave" style={style}>
      {children}
    </div>
  );
}
