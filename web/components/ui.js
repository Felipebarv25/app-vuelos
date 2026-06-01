"use client";
// Pequeños componentes visuales reutilizables.

export function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        whiteSpace: "nowrap",
        background: activo ? "var(--azul)" : "#fff",
        color: activo ? "#fff" : "var(--azul-osc)",
        border: "1px solid " + (activo ? "var(--azul)" : "var(--borde)"),
        padding: "9px 16px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        flexShrink: 0,
        boxShadow: activo ? "0 2px 8px rgba(37,99,235,.3)" : "0 1px 3px rgba(15,23,42,.05)",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

export function Boton({ onClick, href, variante = "primario", children, style }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    textAlign: "center",
    ...style,
  };
  const estilos = {
    primario: { background: "var(--azul)", color: "#fff" },
    sec: { background: "#fff", color: "var(--azul)", border: "1px solid var(--azul)" },
    verde: { background: "var(--verde)", color: "#fff" },
  };
  const s = { ...base, ...estilos[variante] };
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener" style={s}>
        {children}
      </a>
    );
  return (
    <button onClick={onClick} style={s}>
      {children}
    </button>
  );
}

export function Tarjeta({ children, style }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eef2f7",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 2px 10px rgba(15,23,42,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
