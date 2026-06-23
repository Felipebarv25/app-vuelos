// POST /api/auth/demo
// Body: { plan: "pro" | "free" }
//
// Crea una sesion INSTANTANEA para una cuenta demo predefinida. No envia
// codigo por email, no requiere Google. Util para que visitantes prueben la
// app entera sin tener que crear cuenta.
//
// - plan="pro":  email demo-pro@viajero360.app → tiene Pro automatico SIEMPRE
//                (requiere que este email este en la env var PRO_EMAILS del
//                servidor; si no, las features Pro mostraran paywall).
// - plan="free": email demo-free@viajero360.app → NO esta en PRO_EMAILS, asi
//                que el usuario ve el flujo de paywall normal (limit 1 alerta,
//                exportar PDF gateado, etc.). Muestra como se siente la app
//                desde el plano libre.
//
// La sesion vive en KV con TTL 30 dias (igual que las normales). El cliente
// recibe el token y lo guarda en localStorage o sessionStorage segun la
// politica habitual de AppContext.

import { kvActivo } from "@/lib/kv";
import { crearSesion } from "@/lib/auth";

export const runtime = "nodejs";

const DEMO_CONFIG = {
  pro:  { email: "demo-pro@viajero360.app",  nombre: "Demo Pro",  plan: "pro" },
  free: { email: "demo-free@viajero360.app", nombre: "Demo Free", plan: "free" },
};

export async function POST(req) {
  if (!kvActivo()) {
    return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  }

  let plan;
  try {
    const body = await req.json();
    plan = body?.plan === "free" ? "free" : "pro";
  } catch {
    plan = "pro";
  }

  const cfg = DEMO_CONFIG[plan];
  const token = await crearSesion({
    email: cfg.email,
    nombre: cfg.nombre,
    demo: true,
    demoPlan: plan,
  });

  if (!token) {
    return Response.json({ ok: false, motivo: "no-creada" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    token,
    usuario: { email: cfg.email, nombre: cfg.nombre, demo: true, demoPlan: plan },
  });
}
