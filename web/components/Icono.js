// Set de íconos SVG (estilo Lucide, trazo uniforme) — reemplaza a los emojis de
// la UI para una apariencia profesional y consistente en todos los sistemas.
// Uso: <Icono nombre="wallet" size={20} className="..." />
const PATHS = {
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};

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
