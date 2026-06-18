// Política de privacidad pública. Esta página es referida desde /pro y desde
// el footer global. Cubre los requisitos básicos de Habeas Data en Colombia
// (Ley 1581 de 2012) y GDPR para usuarios europeos. Si activamos checkout en
// Lemon Squeezy y/o expandimos a más territorios, conviene revisar con un
// abogado y agregar secciones específicas (transferencias internacionales,
// menores, retención, derechos del titular).

export const metadata = {
  title: "Política de privacidad — Viajero 360",
  description: "Cómo recolectamos, usamos y protegemos tu información en Viajero 360.",
  robots: { index: true, follow: true },
};

export default function PaginaPrivacidad() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-700">
      <a href="/" className="text-[13px] font-bold text-marca-700 hover:underline dark:text-marca-300">← Inicio</a>
      <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
        Política de privacidad
      </h1>
      <p className="mt-2 text-[13px] text-slate-500">
        Última actualización: 15 de junio de 2026
      </p>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
        <Seccion titulo="1. Quiénes somos">
          <p>
            Viajero 360 es un servicio operado de manera independiente desde Colombia.
            Esta política explica qué datos recolectamos cuando usas la aplicación
            web disponible en{" "}
            <a href="https://app-vuelos-mfos.vercel.app/" className="text-marca-700 underline dark:text-marca-300">
              app-vuelos-mfos.vercel.app
            </a>{" "}
            (en adelante, el &quot;Servicio&quot;) y cómo los utilizamos.
          </p>
          <p>
            Si tienes dudas o quieres ejercer tus derechos de acceso, rectificación,
            cancelación u oposición (ARCO) sobre tus datos personales, escribe a{" "}
            <a href="mailto:felipebarv@gmail.com" className="text-marca-700 underline dark:text-marca-300">
              felipebarv@gmail.com
            </a>.
          </p>
        </Seccion>

        <Seccion titulo="2. Qué datos recolectamos">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <b>Cuenta:</b> tu dirección de email cuando inicias sesión (Google o
              código por email). Si usas Google, también recibimos tu nombre y la foto
              pública de tu perfil.
            </li>
            <li>
              <b>Preferencias de viaje:</b> los destinos, presupuestos, fechas y
              alertas que tú creas para personalizar tu experiencia.
            </li>
            <li>
              <b>Pagos:</b> cuando contratas Pro, el procesamiento es realizado por{" "}
              <a href="https://lemonsqueezy.com" target="_blank" rel="noopener" className="text-marca-700 underline dark:text-marca-300">
                Lemon Squeezy
              </a>, que actúa como Merchant of Record. Nosotros recibimos del proveedor
              solo el estado de tu suscripción (activa, cancelada, expirada) y el email
              asociado. No almacenamos datos de tu tarjeta.
            </li>
            <li>
              <b>Datos técnicos:</b> idioma del navegador, tipo de dispositivo, hora
              de la última visita. Esto se usa para mejorar el Servicio.
            </li>
            <li>
              <b>Ubicación aproximada:</b> si tú la autorizas explícitamente desde el
              navegador, para mostrarte tu posición sobre el mapa durante un itinerario.
              Nunca se almacena ni se comparte.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="3. Para qué los usamos">
          <ul className="ml-5 list-disc space-y-2">
            <li>Mantener tu sesión iniciada y recordar tus preferencias.</li>
            <li>Enviarte por email las alertas de precio que tú mismo configuraste.</li>
            <li>Sincronizar tus viajes guardados y favoritos en la nube.</li>
            <li>Detectar abusos o uso fraudulento del Servicio.</li>
            <li>Procesar pagos a través de Lemon Squeezy si eliges suscribirte.</li>
          </ul>
        </Seccion>

        <Seccion titulo="4. Con quién los compartimos">
          <p>
            <b>No vendemos datos personales a terceros.</b> Compartimos información
            solo con los proveedores estrictamente necesarios para operar el Servicio:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li><b>Vercel</b> (hosting de la aplicación).</li>
            <li><b>Vercel KV / Upstash</b> (base de datos para sesiones y alertas).</li>
            <li><b>Resend</b> (envío de emails transaccionales y de alertas).</li>
            <li><b>Google</b> (solo si eliges iniciar sesión con Google).</li>
            <li><b>Lemon Squeezy</b> (solo si contratas Pro).</li>
          </ul>
          <p>
            Cada uno opera bajo sus propias políticas de privacidad y bajo acuerdos de
            tratamiento de datos.
          </p>
        </Seccion>

        <Seccion titulo="5. Cookies y almacenamiento local">
          <p>
            Usamos el almacenamiento local del navegador (localStorage / sessionStorage)
            para guardar el token de sesión, el idioma elegido y los viajes en curso.
            No usamos cookies de seguimiento publicitario ni analíticos de terceros como
            Google Analytics.
          </p>
        </Seccion>

        <Seccion titulo="6. Tus derechos">
          <p>
            En cumplimiento de la <b>Ley 1581 de 2012 (Habeas Data, Colombia)</b> y del{" "}
            <b>Reglamento General de Protección de Datos (RGPD/GDPR, Unión Europea)</b>,
            tienes derecho a:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Acceder a los datos personales que tenemos sobre ti.</li>
            <li>Solicitar la rectificación o actualización de datos inexactos.</li>
            <li>Solicitar la eliminación de tu cuenta y todos tus datos.</li>
            <li>Oponerte al tratamiento o solicitar su limitación.</li>
            <li>Recibir tus datos en un formato portable (JSON).</li>
            <li>Retirar tu consentimiento en cualquier momento.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, escribe a{" "}
            <a href="mailto:felipebarv@gmail.com" className="text-marca-700 underline dark:text-marca-300">
              felipebarv@gmail.com
            </a>. Te responderemos en un plazo máximo de 15 días hábiles.
          </p>
        </Seccion>

        <Seccion titulo="7. Retención de datos">
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si dejas de usar el
            Servicio durante más de 12 meses, podemos eliminar tu cuenta y datos
            asociados previa notificación a tu email. Si pides el cierre de tu cuenta,
            eliminaremos tus datos en un plazo de 30 días, salvo aquellos que la ley
            nos obligue a conservar (registros contables de pagos: 5 años).
          </p>
        </Seccion>

        <Seccion titulo="8. Cambios a esta política">
          <p>
            Cuando hagamos cambios materiales avisaremos en la aplicación con al menos
            7 días de anticipación. La fecha de &quot;última actualización&quot; arriba
            siempre refleja la versión vigente.
          </p>
        </Seccion>

        <Seccion titulo="9. Contacto">
          <p>
            Para cualquier pregunta sobre esta política, escribe a{" "}
            <a href="mailto:felipebarv@gmail.com" className="text-marca-700 underline dark:text-marca-300">
              felipebarv@gmail.com
            </a>.
          </p>
        </Seccion>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-[13px] font-semibold text-marca-700 dark:text-marca-300">
        <a href="/terminos" className="hover:underline">Términos y condiciones</a>
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
