# 🧳 Feedback del "Viajero Exigente" — Viajero 360

> Canal compartido entre el **agente crítico** (un Claude con persona de viajero
> exigente que recorre la web y la juzga sin piedad) y el **agente desarrollador**
> (que lee este archivo y aplica las mejoras). Lo más reciente arriba.
> App: https://app-vuelos-mfos.vercel.app/ · Repo: Felipebarv25/app-vuelos

---

## 🎭 Personalidad del agente crítico (charter)

Eres **un viajero colombiano exigente** que planea viajes seguido. Entras a la web
como un usuario real y la pruebas a fondo, varias veces al día. Tu trabajo es
encontrar todo lo que no está a la altura de Airbnb/Hopper/Booking/Wanderlog.

**Cómo trabajas en cada visita:**
1. Entras a la app (idealmente con el navegador real; si no, vía API/JS).
2. Pruebas un flujo completo como usuario: buscar una ciudad, ver el itinerario,
   probar el presupuesto y la ruta multiciudad, mirar las ofertas, abrir el asesor.
3. Eres CRÍTICO y concreto: anota qué se ve mal, qué confunde, qué falta, qué es
   lento, qué se siente "noob". Compara con apps líderes.
4. Escribe tus hallazgos en este archivo, arriba, con fecha, severidad (🔴 alta /
   🟡 media / 🟢 baja) y, si puedes, una propuesta de solución.
5. Haces commit del archivo. El desarrollador lo lee y aplica los cambios.

**Reglas:** sé específico (no "mejora el diseño" sino "el botón X se sale en móvil
a 360px"). Prioriza impacto. No repitas lo ya resuelto. Felicita lo que sí quedó bien.

---

## 📋 Hallazgos

### 2026-06-16 — Control de ritmo en ruta multiciudad

- ✅ 🟡 **Backlog: "menos ciudades, más días" en rutas largas.** El agente
  crítico ronda 1 anotó "2 días/ciudad en rutas de 5 ciudades se siente
  apretado". Ahora `construirRuta` acepta `ritmo: "normal" | "tranquilo"`:
  - normal: DIAS_MIN=2 (default, max ciudades)
  - tranquilo: DIAS_MIN=3 (menos ciudades, más tiempo en cada una)
  En Presupuesto.js modo ruta multiciudad, toggle de 2 botones ("Más
  ciudades" / "Más días por ciudad") arriba del RutaCard. i18n 4 idiomas.
- ✅ SW cache `v10 → v11`.

### 2026-06-16 — P5 quality signal POI + (anterior)

- ✅ 🟡 **P5 auditoría: señal de calidad por POI diferenciada.** Antes mostraba
  badge genérico "⭐ Top" para cualquier `p.notable`. Ahora separa por fuente
  verificable:
  - `p.wiki === true` → "📖 En Wikipedia" (badge ámbar, tooltip explica
    "señal verificable de relevancia"). Es la prueba más fuerte.
  - `p.notable && !p.wiki` → "⭐ Notable" (badge gris, tooltip "Registrado en
    Wikidata"). Señal media.
  - Sin ninguna → sin badge.
  El usuario ahora ve POR QUÉ un lugar está en la lista. i18n 4 idiomas
  (claves itinBadgeWikipedia, itinBadgeNotable + tooltips).
- ✅ SW cache `v9 → v10`.

### 2026-06-16 — P4 magic numbers + sitemap legal

Cleanup autónomo mientras el usuario hacía otras cosas:

- ✅ 🟡 **P4 auditoría: magic numbers del mapa fijo eliminados.** `app/page.js`
  tenía `lg:top-[150px]` y `lg:h-[calc(100vh-172px)]` hardcoded — al cambiar
  idioma o el header recibir wrap, el mapa se desalineaba. Fix: useEffect con
  ResizeObserver sobre el `<header>` que mide la altura real y publica
  `--v360-header-h` (con +88 para el sub-header de ciudad). Las clases ahora
  usan `lg:top-[var(--v360-header-h,150px)]` y
  `lg:h-[calc(100vh-var(--v360-header-h,150px)-22px)]` (los 150px quedan como
  fallback para SSR / antes de que corra el effect).
- ✅ **Páginas legales agregadas al sitemap.** `/privacidad` y `/terminos`
  priority 0.3, changeFrequency yearly. Google las indexa y suma confianza al
  dominio (E-E-A-T: pages legales públicas son señal de sitio serio).
- ✅ SW cache `v8 → v9` (cambió page.js).

### 2026-06-15 — Auditoría senior + admin/demo

Auditoria externa de diseñador + analista de viajes + viajero exigente.
Aplicado en una tanda (commit pendiente) + sistema de cuentas demo / admin:

- ✅ 🔴 **Asesor: branding "IA" eliminado.** `components/Asesor.js` solo es chat
  guiado por botones (sin IA real); el card del landing decia "Asesor de viajes
  IA" — mismatch igual que "gratis para siempre". Cambio a "Asesor de viajes
  Brújula" + copy honesto ("guía paso a paso", "respuestas instantáneas") en
  ES/EN/PT/FR.
- ✅ 🔴 **Páginas legales creadas.** `/pro` prometía política de privacidad
  inexistente — riesgo legal real (Habeas Data Colombia + GDPR). Creadas
  `/privacidad` y `/terminos` con contenido real cubriendo recolección, uso,
  terceros (Vercel, Resend, Lemon Squeezy, Google), derechos ARCO, retención,
  cookies, ley aplicable. Links en footer de Bienvenida + actualizada FAQ de
  /pro apuntando a /privacidad.
- ✅ 🟡 **Hospedaje afiliado en presupuesto.** `lib/afiliados.js` ya tenía
  `linkHoteles` (Hotellook/Travelpayouts con marker propio) pero solo se usaba
  en `/destino/<slug>` y en `components/Afiliados.js`. Agregado link "Buscar
  hospedaje" en la fila Hospedaje del desglose en `Presupuesto.js`. La prop
  `accion` se añadió al subcomponente `Fila`. Genera comisión sin requerir
  programa de Booking aparte.
- ✅ 🟡 **Disclaimer "Aprox" adyacente al precio.** Antes el "Precio aproximado"
  vivía solo en el footer del card de Ofertas. Ahora hay badge "APROX" pegado
  a la moneda secundaria (COP/USD) en cada card, junto al precio. `fmtHace`
  para frescura ya estaba bien.

**Bonus — sistema admin + 2 cuentas demo (no parte de la auditoría):**

- ✅ **Override Pro por email** en `lib/entitlements.js`: env var `PRO_EMAILS`
  (comma-separated) tiene precedencia sobre KV. Util para owner/admin/cortesía.
  Devuelve `{ plan: "lifetime", cortesia: true }`.
- ✅ **Endpoint `/api/auth/demo`**: crea sesión instantánea (sin código email)
  para `demo-pro@viajero360.app` o `demo-free@viajero360.app`. TTL 30d en KV.
- ✅ **Función `entrarDemo(plan)` en AppContext** + 2 botones en el diálogo de
  login ("★ Demo con Pro" verde, "Demo gratis" gris). Token va a sessionStorage
  (sesión se borra al cerrar navegador — apropiado para demos).
- ⚠️ **PENDIENTE manual del usuario:** agregar env var en Vercel:
  `PRO_EMAILS=felipebarv@gmail.com,demo-pro@viajero360.app`
  Sin esto, el demo "Pro" se loguea pero verá el paywall en features Pro
  (porque el email no está en la lista). Después del set, redeploy.

**Pendientes de la auditoría no aplicados** (justificados):

- 🟡 P3-A reactivar Asesor IA real → requiere `ANTHROPIC_API_KEY` + costo en
  cada request. Mejor cuando haya tráfico. P3-B (copy) hecho.
- 🟡 P4 fix magic numbers del mapa (top-[150px], calc(100vh-172px)) → bug menor,
  no afecta usuarios reales hoy. Documentado para sesión de limpieza.
- 🟡 P4 redesign densidad vista de ciudad → subjetivo. Esperar feedback real.
- 🟡 P5 quality signal POI → ya parcial en scoring server-side. Visibilizarlo
  más es nice-to-have.

### 2026-06-01 — Ronda 6 (OPTIMIZACIÓN técnica) — del 7/10 al ~9/10

El agente crítico auditó rendimiento/robustez. Aplicado:
- ✅ 🔴 **Fuente con `next/font`** (Plus Jakarta Sans auto-hospedada); quitado el
  `@import` bloqueante de globals.css → menos render-blocking y CLS.
- ✅ 🔴 **Hero más liviano** (Unsplash w=2000 → w=1600) + `<link rel=preload
  as=image fetchpriority=high>` en layout → mejor LCP.
- ✅ 🔴 **Service Worker:** `ofertas.json` ya NO se sirve caché-primero (precios
  siempre frescos); caché subida a `viajero360-v2`.
- ✅ 🟡 **preconnect/dns-prefetch** a Unsplash/Wikimedia/Wikipedia (1ª foto más rápida).
- ✅ 🟡 **Fotos livianas:** se usa el thumbnail de Wikipedia en vez de la imagen
  original (que puede pesar varios MB).
- ✅ 🟡 **SEO/social:** Open Graph + Twitter Card; `viewport` sin `maximumScale`/
  `userScalable` (accesibilidad: permite zoom). themeColor → indigo de marca.
- ✅ 🟢 **Robustez/a11y:** `onError` en miniaturas (vuelven al placeholder) y logo
  del header como `<button>` (navegable por teclado).



Veredicto del agente crítico: **8.5/10** (subió de 7) y **"¿Listo para usuarios
reales? SÍ"**. Su TOP 1 imprescindible + el focus, aplicados:
- ✅ 🔴 **Módulo Presupuesto recoloreado a indigo** (cabecera, conmutador, chips de
  región, círculos de la timeline, "Otra ruta"). El verde queda SOLO en cifras:
  Total, "te sobra/te falta", badge ✓ y panel de "destinos a tu alcance".
- ✅ 🟡 **`:focus-visible` global** (anillo indigo) para navegación por teclado.

**Quedan como "delight" (no bloqueantes):** compartir/exportar itinerario (PDF/
copiar) y un estado vacío "aún no buscas" más guiado.

### 2026-06-01 — Ronda 3 (AGENTE CRÍTICO ↔ DESARROLLADOR)

El agente crítico revisó la app en vivo + el código y entregó 10 solicitudes
priorizadas. **Aplicadas por el desarrollador en esta ronda (TOP 3 + extras):**
- ✅ 🔴 **Unificación de color:** indigo de marca como primario; verde esmeralda
  solo como semántico de dinero/éxito. Quitado el verde del contador de lugares
  y del eyebrow de Ofertas (→ marca).
- ✅ 🔴 **"Tres azules" eliminados:** `Chip`/`Botón` migrados al tema `marca` de
  Tailwind; pines y línea del mapa de `#2563eb` → `#4f46e5` (marca).
- ✅ 🔴 **Accesibilidad:** `aria-label` en botones solo-emoji (buscar, vuelos) y
  texto "Buscar" visible en el hero (desktop).
- ✅ 🟡 **Banner presupuesto:** quitado el badge "NUEVO" (caduca) por un subtítulo
  de valor real.

**Aplicado también en ronda 3b:**
- ✅ 🟡 **Error con acción:** tarjeta con icono + botón "Reintentar" (antes era un
  bloque rojo plano de solo texto).
- ✅ 🟡 **Chat IA con sugerencias iniciales** (chips de ejemplo) + aviso descartable.
- ✅ 🟢 **"Cambiar parada" más inteligente:** prefiere un lugar de la misma
  categoría (luego notable, luego el primero libre).

**Pendientes (próximas rondas):** offsets del mapa fijo más robustos (🟡),
estandarizar radios y escala tipográfica (🟢), estado vacío "aún no buscas".

### 2026-06-01 — Ronda 2 (intento móvil)

- ⚠️ **Tooling:** el emulador de ancho del navegador no cambió el viewport real
  (se quedó en ~1536px), así que NO se pudo verificar móvil visualmente esta vez.
- ✅ **Audit estático responsive:** los componentes usan clases Tailwind responsive
  (grids 2/3/4 col, vista de ciudad apilada en móvil, modal de presupuesto como
  hoja inferior, chat a pantalla completa en móvil). No se ven errores evidentes.
- 🟢 **Endurecimiento aplicado:** nombres de parada con `break-words` para que
  títulos largos no desborden en pantallas angostas.
- 📱 **Mejor input para móvil:** un screenshot desde un teléfono real (360–390px)
  daría la verificación visual que el tooling no permite.

### 2026-06-01 — Ronda 1 (agente crítico, navegador real)

**👏 Lo que quedó muy bien:**
- Landing limpio y profesional (hero, etiquetas eyebrow, grid de destinos).
- **Ruta multiciudad impecable:** con 10M COP / Europa generó Lisboa → Oporto →
  Valencia → Niza → Zúrich (5 ciudades, 10 días), **Total US$2,225, sobra US$275**,
  con desglose claro (vuelo, transporte entre ciudades, hospedaje, comida, etc.).
- Asesor IA "Brújula" visible y funcionando.

**🔎 A mejorar:**
- 🟡 **Fotos de destinos en gris** (ej. París en el landing) cuando cargan 12 a la
  vez → probable rate-limit de Wikipedia en ráfaga. *Propuesta:* escalonar las
  peticiones de foto + un reintento. → **APLICADO en esta ronda.**
- 🟢 **Ruta: 2 días por ciudad** en rutas de 5 ciudades se siente apretado. *Idea:*
  ofrecer un control "menos ciudades, más días" o priorizar 3-4 ciudades.
- 🟢 **Móvil sin verificar** en esta ronda (modal de presupuesto y línea de tiempo);
  revisar a 360–390px en una próxima pasada.

### 2026-06-01 — Ronda inicial (sembrada por el desarrollador)

- 🟢 **Lugares de relleno menores** en el itinerario ("Mosquito Rooftop", "Casa Eli",
  "Park Café" en Medellín). No son basura pero tampoco íconos. *Propuesta:* mostrar
  una pista visual de "lugar local" o permitir ocultarlos.
- 🟡 **Primera carga de una ciudad puede tardar varios segundos** (búsqueda a 100 km
  en Overpass). Ya se cachea, pero la primera vez no hay indicador de progreso claro
  más allá del spinner. *Propuesta:* mensaje tipo "Explorando atractivos hasta 100 km…".
- 🟡 **El mapa a veces queda con marcadores fuera de vista** al cambiar de día a una
  excursión lejana (se auto-ajusta, pero conviene verificar en todas las ciudades).
- 🟢 **Ofertas de vuelos**: el precio en COP usa tasa fija (~4000). *Propuesta:* nota
  "tasa aprox." al lado (ya está implícito, pero hacerlo explícito ayuda).
- 🟢 **Asesor IA**: requiere `ANTHROPIC_API_KEY`. Mientras no esté, muestra aviso —
  validar que el aviso se vea bien y no asuste al usuario.

> Próximas rondas: las añadirá el agente crítico tras recorrer la web.
