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
