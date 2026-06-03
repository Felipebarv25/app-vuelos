// Amadeus "Points of Interest" — señal de POPULARIDAD real por atracción.
// Solo se usa en el servidor (app/api/lugares). Si no hay credenciales o la
// ciudad no tiene cobertura, devuelve [] y la app sigue con su heurística.
//
// Credenciales (variables de entorno en Vercel):
//   AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET
//   AMADEUS_HOSTNAME = "production" para api.amadeus.com (por defecto: test)

function host() {
  return process.env.AMADEUS_HOSTNAME === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

// Caché de token en memoria (sobrevive entre peticiones en una lambda caliente).
let _token = null;
let _expira = 0;

async function token() {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) return null; // sin credenciales: desactivado
  if (_token && Date.now() < _expira) return _token;
  try {
    const ctrl = new AbortController();
    const idt = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${host()}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(
        id
      )}&client_secret=${encodeURIComponent(secret)}`,
      signal: ctrl.signal,
    });
    clearTimeout(idt);
    if (!r.ok) return null;
    const d = await r.json();
    _token = d.access_token;
    // Renovar 60s antes de que expire de verdad.
    _expira = Date.now() + Math.max(0, (d.expires_in || 1800) - 60) * 1000;
    return _token;
  } catch {
    return null;
  }
}

// Devuelve los POIs populares alrededor de un punto: [{name, lat, lon, rank, categoria}].
// radioKm: Amadeus admite 0–20 km.
export async function poisAmadeus(lat, lon, radioKm = 20) {
  const tk = await token();
  if (!tk) return [];
  try {
    const ctrl = new AbortController();
    const idt = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `${host()}/v1/reference-data/locations/pois?latitude=${lat}&longitude=${lon}&radius=${Math.min(
        20,
        Math.round(radioKm)
      )}&page%5Blimit%5D=100`,
      { headers: { Authorization: `Bearer ${tk}` }, signal: ctrl.signal }
    );
    clearTimeout(idt);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data || [])
      .filter((p) => p.geoCode)
      .map((p) => ({
        name: p.name,
        lat: p.geoCode.latitude,
        lon: p.geoCode.longitude,
        rank: Number(p.rank) || null,
        categoria: p.category || null,
      }));
  } catch {
    return [];
  }
}
