// Términos y condiciones de uso. Esta página es referida desde el footer y
// desde /pro al momento de contratar. Cubre lo básico para una app web con
// suscripción procesada por Lemon Squeezy (MoR). Para territorios complejos
// o expansión a más países, conviene revisar con un abogado local.

export const metadata = {
  title: "Términos y condiciones — Viajero 360",
  description: "Reglas de uso del servicio Viajero 360.",
  robots: { index: true, follow: true },
};

export default function PaginaTerminos() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-700">
      <a href="/" className="text-[13px] font-bold text-marca-700 hover:underline dark:text-marca-300">← Inicio</a>
      <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
        Términos y condiciones
      </h1>
      <p className="mt-2 text-[13px] text-slate-500">
        Última actualización: 15 de junio de 2026
      </p>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
        <Seccion titulo="1. Aceptación de los términos">
          <p>
            Al usar Viajero 360 (en adelante, el &quot;Servicio&quot;) aceptas estos
            términos. Si no estás de acuerdo, por favor no uses el Servicio.
          </p>
          <p>
            El Servicio es operado de manera independiente desde Colombia. La ley
            aplicable es la colombiana, salvo disposición en contrario para territorios
            con normativa imperativa de protección al consumidor.
          </p>
        </Seccion>

        <Seccion titulo="2. Qué es Viajero 360">
          <p>
            Viajero 360 es una herramienta de <b>planificación de viajes y comparación
            de precios</b>. Mostramos información obtenida de fuentes públicas y
            agregadores (Aviasales/Travelpayouts, OpenStreetMap, Wikipedia, Wikidata) y
            facilitamos itinerarios personalizados.
          </p>
          <p>
            <b>No somos una agencia de viajes ni revendemos vuelos, hospedajes ni
            seguros.</b> Cuando reservas algo desde el Servicio, lo haces directamente
            con el proveedor final (aerolínea, hotel, plataforma), bajo sus términos.
          </p>
        </Seccion>

        <Seccion titulo="3. Precios y disponibilidad">
          <p>
            Los precios mostrados son aproximaciones obtenidas de fuentes externas y
            pueden estar desactualizados. Los precios en pesos colombianos (COP) son
            estimaciones convertidas a tasas que se actualizan periódicamente y se
            marcan como &quot;aprox&quot;. El precio real, la disponibilidad y las
            condiciones finales las define cada proveedor al momento de la reserva.
          </p>
          <p>
            <b>No garantizamos que puedas comprar al precio mostrado.</b> Te
            recomendamos comparar y verificar antes de pagar.
          </p>
        </Seccion>

        <Seccion titulo="4. Cuenta de usuario">
          <p>
            Para usar funcionalidades como guardar viajes, recibir alertas y sincronizar
            entre dispositivos necesitas iniciar sesión. Eres responsable de mantener
            la seguridad de tu cuenta y del uso que se haga desde ella.
          </p>
          <p>
            Podemos suspender o cancelar tu cuenta si detectamos abuso (intentos de
            fraude, scraping masivo, automatización no autorizada, contenido ilegal).
          </p>
        </Seccion>

        <Seccion titulo="5. Plan Pro y pagos">
          <p>
            El plan Pro habilita funciones premium (alertas ilimitadas, exportar PDF,
            historial completo, sin anuncios) por una suscripción mensual, anual o pago
            único de por vida (Lifetime). Los precios actuales se muestran en{" "}
            <a href="/pro" className="text-marca-700 underline dark:text-marca-300">/pro</a>.
          </p>
          <p>
            Los pagos son procesados por <b>Lemon Squeezy</b>, que actúa como Merchant
            of Record. La emisión de facturas, las retenciones de impuestos aplicables
            y la garantía de devolución son administradas por Lemon Squeezy bajo sus
            propios términos.
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <b>Garantía de devolución:</b> 14 días desde la compra, sin preguntas, a
              través del soporte de Lemon Squeezy.
            </li>
            <li>
              <b>Renovación:</b> las suscripciones mensual y anual se renuevan
              automáticamente. Puedes cancelarlas en cualquier momento desde tu cuenta
              de Lemon Squeezy o escribiéndonos.
            </li>
            <li>
              <b>Lifetime:</b> pago único. Mantiene acceso mientras el Servicio esté
              operativo. No incluye actualizaciones futuras que requieran integraciones
              de pago adicionales con terceros.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="6. Uso aceptable">
          <p>Al usar el Servicio te comprometes a NO:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Hacer scraping automatizado o ataques de denegación de servicio.</li>
            <li>Revender, redistribuir o explotar comercialmente el contenido sin permiso.</li>
            <li>Suplantar la identidad de otra persona o crear cuentas falsas.</li>
            <li>Publicar contenido ilegal, abusivo o que viole derechos de terceros.</li>
            <li>Eludir las protecciones técnicas o los límites del plan gratuito.</li>
          </ul>
        </Seccion>

        <Seccion titulo="7. Propiedad intelectual">
          <p>
            La marca &quot;Viajero 360&quot;, el logo, el diseño y el código son
            propiedad de su autor. La información agregada (precios de vuelos, fotos
            de Wikipedia, datos de OpenStreetMap) pertenece a sus respectivos titulares
            y se muestra bajo sus licencias.
          </p>
        </Seccion>

        <Seccion titulo="8. Limitación de responsabilidad">
          <p>
            El Servicio se ofrece &quot;tal cual&quot;. Hacemos esfuerzos razonables
            para que los datos sean precisos, pero <b>no garantizamos exactitud,
            disponibilidad, ni que el Servicio esté libre de errores</b>. Tampoco
            respondemos por decisiones tomadas con base en la información mostrada
            (cambios de vuelos, cancelaciones, fluctuaciones de precio, problemas con
            proveedores externos).
          </p>
          <p>
            En la máxima medida permitida por la ley, nuestra responsabilidad por
            cualquier reclamación relacionada con el Servicio se limita al monto
            pagado por el usuario en los 12 meses anteriores al hecho.
          </p>
        </Seccion>

        <Seccion titulo="9. Cambios al Servicio y a estos términos">
          <p>
            Podemos cambiar, suspender o descontinuar el Servicio en cualquier momento.
            Si los cambios afectan los términos de tu suscripción Pro vigente, te
            avisaremos por email con al menos 30 días de anticipación.
          </p>
        </Seccion>

        <Seccion titulo="10. Ley aplicable y jurisdicción">
          <p>
            Estos términos se rigen por las leyes de la República de Colombia. Las
            controversias se resolverán en los tribunales de Bogotá, salvo cuando la
            normativa imperativa del país del consumidor disponga otra cosa.
          </p>
        </Seccion>

        <Seccion titulo="11. Contacto">
          <p>
            Para cualquier pregunta sobre estos términos, escribe a{" "}
            <a href="mailto:felipebarv@gmail.com" className="text-marca-700 underline dark:text-marca-300">
              felipebarv@gmail.com
            </a>.
          </p>
        </Seccion>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-[13px] font-semibold text-marca-700 dark:text-marca-300">
        <a href="/privacidad" className="hover:underline">Política de privacidad</a>
        <a href="/" className="hover:underline">← Volver al inicio</a>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }) {
  return (
    <section>
      <h2 className="font-display text-[22px] font-extrabold text-marca-900 dark:text-marca-300">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
