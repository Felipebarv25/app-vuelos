// Cliente: helpers para grabar eventos de gusto + leer recomendaciones.
//
// Si el usuario tiene sesion email (token en localStorage), llamamos al
// servidor para persistir en KV. Si no, no hacemos nada (los gustos quedan
// para cuando se registre). Versiones futuras podrian mezclar localStorage
// para anonimos.

function token() {
  // Sesiones email magic code → localStorage.
  // Sesiones Demo → sessionStorage. Caer a sessionStorage si localStorage está vacío.
  try {
    return localStorage.getItem("anduve_auth_token")
        || sessionStorage.getItem("anduve_auth_token");
  } catch { return null; }
}

// Envia un evento de gusto al servidor (no bloquea ni rompe si falla).
export function registrarEvento(evento) {
  const tk = token();
  if (!tk) return;
  try {
    const body = JSON.stringify(evento);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${tk}` };
    // sendBeacon no acepta headers; usamos fetch keepalive para que el envio
    // sobreviva incluso si el usuario cierra la pestana justo despues.
    fetch("/api/profile/evento", { method: "POST", headers, body, keepalive: true })
      .catch(() => {});
  } catch {}
}

// Lee recomendaciones + tema del usuario actual. Si no hay sesion o no hay
// datos suficientes, devuelve un objeto vacio para que la UI use defaults.
export async function obtenerRecomendaciones() {
  const tk = token();
  if (!tk) return { tema: "general", recomendaciones: [], hayDatos: false };
  try {
    const r = await fetch("/api/profile/recomendar", {
      headers: { Authorization: `Bearer ${tk}` },
    });
    if (!r.ok) return { tema: "general", recomendaciones: [], hayDatos: false };
    const d = await r.json();
    return {
      tema: d?.tema || "general",
      recomendaciones: d?.recomendaciones || [],
      hayDatos: !!d?.perfil?.hayDatos,
    };
  } catch {
    return { tema: "general", recomendaciones: [], hayDatos: false };
  }
}
