// Detecta si las env vars de OAuth estan configuradas para evitar mostrar
// botones que llevan a "Server error". Hoy solo Google esta cableado; cuando
// agreguemos magic link / codigo por email se reportaran aqui tambien.
//
// Devuelve { google: bool, magicCode: bool }. Cache corto (5 min) — esto rara
// vez cambia y baja el ruido al edge.

export const runtime = "nodejs";

export async function GET() {
  const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
  const magicCode = !!process.env.RESEND_API_KEY;
  return new Response(
    JSON.stringify({ google, magicCode }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    }
  );
}
