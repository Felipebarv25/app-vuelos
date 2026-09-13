// POST /api/descubrir
//
// Body: un perfil de busqueda (lib/perfilBusqueda). Devuelve PROPUESTAS DE
// VIAJE ordenadas, no una lista de vuelos.
//
// POR QUE EN EL SERVIDOR Y NO EN EL NAVEGADOR
//
// El motor (construirRuta) es sincrono y podria correr en el cliente —de
// hecho asi lo usa components/Presupuesto.js—. Se hace aqui por tres razones
// concretas:
//
//   1. El tipo de cambio. Convertir el presupuesto del viajero a USD necesita
//      una tasa; obtenerTasasServidor la cachea 6 horas para TODOS, en vez de
//      que cada navegador pida la suya.
//   2. Los precios reales del detector se leen del disco, sin una peticion
//      mas por visitante.
//   3. Se puede comprobar con una peticion, que es como se verifica que el
//      caso de referencia sigue dando lo que tiene que dar.
//
// No guarda nada. Una busqueda no es un viaje: el viaje se crea cuando el
// viajero elige una propuesta y pulsa construir, y eso lo hace /api/rutas.

import path from "path";
import { promises as fs } from "fs";
import { construirMapaOfertas, ofertaParaOrigen } from "@/lib/preciosVuelos";
import { llaveCiudad } from "@/lib/presupuesto";
import { nombreDeIATA } from "@/lib/paisesOrigen";
import { obtenerTasasServidor } from "@/lib/fx";
import { normalizarBusqueda, presupuestoEnUsd } from "@/lib/perfilBusqueda";
import { generarPropuestas, ordenar, ORDENES } from "@/lib/propuestasViaje";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismo patron que lib/historialPrecios: en el despliegue el Root Directory
// es web/, asi que public/ofertas.json SI esta a mano. Si falla, el motor
// sigue funcionando con los precios estimados del catalogo —peor dato, nunca
// dato inventado— y se avisa en la respuesta.
const OFERTAS_PATH = path.join(process.cwd(), "public", "ofertas.json");

let _ofertas;
async function cargarOfertas() {
  if (_ofertas !== undefined) return _ofertas;
  try {
    _ofertas = construirMapaOfertas(JSON.parse(await fs.readFile(OFERTAS_PATH, "utf8")));
  } catch {
    _ofertas = {};
  }
  return _ofertas;
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, motivo: "json" }, { status: 400 });
  }

  const busqueda = normalizarBusqueda(body?.busqueda || body);

  const [tasas, preciosReales] = await Promise.all([
    obtenerTasasServidor().catch(() => null),
    cargarOfertas(),
  ]);

  // obtenerTasasServidor devuelve { porUsd, fecha, fuente, enVivo }, no el
  // mapa suelto. Pasarle el objeto entero a presupuestoEnUsd hacia que
  // aUsdDe buscara tasas["COP"] y no lo encontrara: el presupuesto se caia
  // a null y TODAS las propuestas salian sin veredicto.
  const presupuestoUsd = presupuestoEnUsd(busqueda, tasas?.porUsd);
  // Presupuesto puesto pero sin tasa para convertirlo: se busca sin limite y
  // se dice, en vez de aplicar una tasa inventada y devolver veredictos de
  // presupuesto falsos.
  const sinTasa = busqueda.presupuesto > 0 && presupuestoUsd == null;

  const propuestas = generarPropuestas({
    busqueda,
    presupuestoUsd: sinTasa ? null : presupuestoUsd,
    preciosReales,
    limite: Math.max(3, Math.min(12, Number(body?.limite) || 8)),
  });

  // AEROPUERTO ALTERNATIVO.
  //
  // Para la ciudad de entrada de cada propuesta se mira si alguno de los
  // otros aeropuertos del pais tiene un vuelo mas barato. Solo se dice
  // cuando hay dato REAL por los dos lados: comparar un precio detectado
  // contra una estimacion daria un ahorro inventado.
  //
  // No se asume que haya que usarlos siempre: si el viajero desmarco la
  // flexibilidad de origen, busqueda.origenes trae solo el suyo y esto no
  // encuentra nada que comparar.
  for (const p of propuestas) {
    p.ahorroOrigen = null;
    if (!busqueda.flexibleOrigen || busqueda.origenes.length < 2) continue;
    const llave = llaveCiudad({ ciudad: p.entrada.ciudad, pais: p.entrada.pais });
    const mio = ofertaParaOrigen(preciosReales, llave, busqueda.origen);
    if (!mio || mio.origen !== busqueda.origen) continue;
    let mejor = null;
    for (const iata of busqueda.origenes) {
      if (iata === busqueda.origen) continue;
      const o = ofertaParaOrigen(preciosReales, llave, iata);
      if (o && o.origen === iata && (!mejor || o.precio < mejor.precio)) mejor = o;
    }
    if (mejor && mejor.precio < mio.precio) {
      p.ahorroOrigen = {
        origen: mejor.origen,
        ciudad: nombreDeIATA(mejor.origen),
        ahorroUsd: Math.round((mio.precio - mejor.precio) * busqueda.viajeros),
        fuente: "real",
      };
    }
  }

  // El viajero piensa en su moneda, no en dolares. La tasa ya esta aqui,
  // asi que se convierte una vez en el servidor en vez de que cada
  // navegador se baje el tipo de cambio para pintar seis tarjetas.
  const porUsd = Number(tasas?.porUsd?.[busqueda.moneda]) || null;
  const aVista = (usd) => (porUsd && Number.isFinite(usd) ? Math.round(usd * porUsd) : null);
  for (const p of propuestas) {
    p.totalVista = aVista(p.totalUsd);
    p.desgloseVista = porUsd
      ? Object.fromEntries(Object.entries(p.desglose).map(([k, v]) => [k, aVista(v)]))
      : null;
    p.monedaVista = busqueda.moneda;
    // Lo que haria falta para cubrir TODOS los dias pedidos, tambien en la
    // moneda del viajero: era la ultima cifra que seguia saliendo en dolares
    // dentro de una tarjeta que habla en pesos.
    p.necesarioVista = aVista(p.necesarioParaDiasPedidos);
    if (p.presupuesto?.diferencia != null) p.presupuesto.diferenciaVista = aVista(Math.abs(p.presupuesto.diferencia));
    if (p.ahorroOrigen) p.ahorroOrigen.ahorroVista = aVista(p.ahorroOrigen.ahorroUsd);
  }

  const criterio = ORDENES[body?.orden] ? body.orden : "compatible";

  return Response.json(
    {
      ok: true,
      busqueda,
      presupuestoUsd: sinTasa ? null : presupuestoUsd,
      sinTasaDeCambio: sinTasa,
      hayPreciosReales: Object.keys(preciosReales).length > 0,
      // Igual que en el presupuesto del viaje: se dice si la tasa es de hoy
      // o el respaldo, para no presentar una conversion vieja como fresca.
      cambioEnVivo: Boolean(tasas?.enVivo),
      orden: criterio,
      propuestas: [...propuestas].sort((a, b) => ordenar(a, b, criterio)),
      generadoEn: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
