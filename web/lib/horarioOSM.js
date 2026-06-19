// Parser simplificado del campo `opening_hours` de OSM y cálculo del estado
// de apertura ("Abierto ahora · cierra a las X" / "Cerrado · abre a las Y").
//
// QW1. El formato OSM `opening_hours` es muy expresivo (PH=feriados públicos,
// SH=vacaciones escolares, expresiones por mes, etc.); este parser cubre los
// casos comunes que se ven en POIs turísticos:
//
//   Mo-Fr 09:00-18:00
//   Mo-Su 10:00-22:00
//   Mo-Fr 09:00-12:00,14:00-18:00
//   24/7
//   Mo-Fr 08:00-17:00; Sa 10:00-14:00
//   Mo-Su 09:00-22:00; PH off
//
// Si el formato no se puede parsear, devuelve null (la UI no muestra badge,
// "fail silent" mejor que mostrar dato erróneo).

const DIAS = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 };

function parseDias(rango) {
  rango = rango.trim();
  // "Mo-Fr"
  if (rango.includes("-")) {
    const [a, b] = rango.split("-");
    const da = DIAS[a], db = DIAS[b];
    if (da == null || db == null) return [];
    const out = [];
    let i = da;
    let guard = 0;
    while (guard++ < 8) {
      out.push(i);
      if (i === db) break;
      i = (i + 1) % 7;
    }
    return out;
  }
  // "Mo,Tu,Fr"
  if (rango.includes(",")) {
    return rango
      .split(",")
      .map((d) => DIAS[d.trim()])
      .filter((x) => x != null);
  }
  // "Mo"
  return DIAS[rango] != null ? [DIAS[rango]] : [];
}

function parseHora(s) {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseRegla(regla) {
  if (!regla) return null;
  // Saltar reglas tipo "PH off", "SH off", "PH 10:00-14:00".
  if (/\bPH\b|\bSH\b/.test(regla)) return null;
  const m = regla.trim().match(/^([A-Za-z,\-]+)\s+(.+)$/);
  if (!m) return null;
  const dias = parseDias(m[1]);
  if (!dias.length) return null;
  // "09:00-18:00" o "09:00-12:00,14:00-18:00"
  const periodos = m[2]
    .split(",")
    .map((p) => {
      const mm = p.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
      if (!mm) return null;
      const abre = parseHora(mm[1]);
      const cierra = parseHora(mm[2]);
      if (abre == null || cierra == null) return null;
      return { abre, cierra };
    })
    .filter(Boolean);
  return periodos.length ? { dias, periodos } : null;
}

function parseOH(s) {
  if (!s || typeof s !== "string") return null;
  const clean = s.trim();
  if (/^24\s*\/\s*7$/.test(clean)) {
    return [{ dias: [0, 1, 2, 3, 4, 5, 6], periodos: [{ abre: 0, cierra: 24 * 60 }] }];
  }
  const reglas = clean
    .split(";")
    .map((r) => parseRegla(r.trim()))
    .filter(Boolean);
  return reglas.length ? reglas : null;
}

// Parsea "UTC+01:00", "UTC-05:00", "UTC+05:30" → horas decimales.
export function offsetDeHuso(huso) {
  if (!huso) return null;
  const m = huso.match(/UTC([+\-−])(\d{1,2}):?(\d{2})?/);
  if (!m) return null;
  const signo = m[1] === "-" || m[1] === "−" ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = parseInt(m[3] || "0", 10);
  return signo * (h + min / 60);
}

function fmtHora(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Devuelve el estado de apertura DEL LUGAR (no del usuario) en la zona
// horaria del destino. Si no se puede determinar, devuelve null.
//
//   estado.estado ∈ "abierto" | "cerrado" | "siempre"
//   estado.cierra = "HH:MM" cuando está abierto (hora local del destino)
//   estado.abre   = "HH:MM" cuando está cerrado y abre más tarde hoy
//
// `ahora` opcional para testing; por defecto usa Date.now().
export function estadoApertura(openingHours, huso, ahora = new Date()) {
  const reglas = parseOH(openingHours);
  if (!reglas) return null;
  const offset = offsetDeHuso(huso);
  if (offset == null) return null;
  // Calcular hora local del destino: tomamos `ahora` en epoch ms y aplicamos
  // el offset del destino para extraer la hora "como si fuera local".
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60 * 1000;
  const destDate = new Date(utcMs + offset * 60 * 60 * 1000);
  const diaHoy = destDate.getUTCDay();
  const minHoy = destDate.getUTCHours() * 60 + destDate.getUTCMinutes();

  // 24/7
  if (reglas.length === 1 && reglas[0].dias.length === 7 && reglas[0].periodos[0].cierra === 24 * 60) {
    return { estado: "siempre" };
  }

  for (const r of reglas) {
    if (!r.dias.includes(diaHoy)) continue;
    for (const p of r.periodos) {
      if (minHoy >= p.abre && minHoy < p.cierra) {
        return { estado: "abierto", cierra: fmtHora(p.cierra) };
      }
    }
    // Hay regla para hoy pero no estamos dentro de ningún período.
    // Si hay un período más tarde hoy → abre a esa hora.
    const masTarde = r.periodos.find((p) => minHoy < p.abre);
    if (masTarde) return { estado: "cerrado", abre: fmtHora(masTarde.abre) };
    return { estado: "cerrado" };
  }
  // No hay regla para hoy.
  return { estado: "cerrado" };
}
