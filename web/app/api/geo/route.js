// Detecta el pais del visitante usando los headers de Vercel Edge Network
// (x-vercel-ip-country, ISO de 2 letras). Sirve para preseleccionar el pais
// de origen en el modal de Presupuesto.
//
// Vercel inyecta estos headers en TODAS las peticiones del proyecto en plan
// Hobby+. Si por algun motivo no estan (entorno local, proxy raro), devolvemos
// null y la UI cae al default (Colombia).

export const runtime = "edge";

export async function GET(req) {
  const pais = req.headers.get("x-vercel-ip-country") || null;
  const ciudad = req.headers.get("x-vercel-ip-city") || null;
  const region = req.headers.get("x-vercel-ip-country-region") || null;

  return new Response(
    JSON.stringify({
      pais, // ej. "CO", "MX", "US"
      ciudad: ciudad ? decodeURIComponent(ciudad) : null,
      region,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache cortito - el geo del usuario rara vez cambia dentro de la sesion
        // y reduce hits al edge.
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
