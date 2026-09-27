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
  // ESTA PUERTA ESTABA ABIERTA A INTERNET.
  //
  // Las cuentas demo se quitaron de la interfaz el 2026-06-22 y el endpoint se
  // dejo vivo "para verificacion admin/QA (curl manual)". El problema es que un
  // curl manual lo puede hacer cualquiera: un POST sin credencial ninguna
  // devolvia un token de sesion valido para demo-pro@viajero360.app, que esta
  // en PRO_EMAILS y por tanto es Pro LIFETIME. Comprobado en produccion:
  //
  //   POST /api/auth/demo {"plan":"pro"}  ->  token
  //   GET  /api/me  (Bearer token)        ->  {"pro":true,"plan":"lifetime"}
  //
  // Es decir: Anduve Pro gratis, para siempre, en una peticion. Eso anula de un
  // golpe el modelo Free/Pro, la suscripcion y los topes de coste, porque la
  // forma mas facil de saltarselos era pedir una cuenta Pro de regalo.
  //
  // Y hay un segundo problema, menos obvio: la cuenta demo es UNA SOLA. Todo el
  // que entrara por aqui aterrizaba en el mismo buzon, viendo —y pudiendo
  // borrar— los viajes y las alertas de los demas.
  //
  // La intencion original (tener una puerta de QA) es buena, asi que no se
  // borra: se le pone la misma cerradura que ya usan los crones. Sin
  // DEMO_LOGIN_SECRET configurado el endpoint NO EXISTE, que es como debe estar
  // en produccion salvo que alguien decida lo contrario a sabiendas.
  const secreto = process.env.DEMO_LOGIN_SECRET;
  if (!secreto || req.headers.get("x-demo-secret") !== secreto) {
    return Response.json({ ok: false, motivo: "no-disponible" }, { status: 404 });
  }

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
