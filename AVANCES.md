# 🌙 Avances de la sesión nocturna — Viajero 360

> Trabajo autónomo mientras duermes. Aquí documento TODO lo que hago, en orden,
> para que mañana lo revises de un vistazo. Lo más reciente arriba.

**Inicio:** 2026-06-01 (noche)
**Autonomía:** total (decido, construyo, pruebo y subo a Vercel)
**App en vivo:** https://app-vuelos-mfos.vercel.app/
**Repo:** https://github.com/Felipebarv25/app-vuelos

---

## 🎯 Plan de la noche (en orden)

1. **[#5] Módulo de Presupuesto de viaje** — la función estrella.
   - Pones presupuesto (ej. 10M COP) + región/destino → te dice qué países/ciudades
     puedes visitar, con costos de vuelo, hospedaje, comida, transporte y gastos.
2. **[#3] Pulido de diseño** — más premium, divertido y claro.
3. **Revisión y QA** — probar muchas ciudades, arreglar lo que falle.
4. **Documentar todo aquí** para tu revisión.

---

## 📋 Registro de cambios (lo más nuevo arriba)

_(Se irá llenando durante la noche…)_

### ✅ QA #6 — Filtro anti-ruido afinado (catalán)
- El filtro v7 NO quitó "Estació de Barcelona - Sants" porque el regex pedía
  "estación/estacion" pero en catalán es "Estació" (sin n).
- ARREGLO: regex ampliado (estaci con n opcional + gare/bahnhof de otros idiomas).
  VALIDADO con 9 casos (Node): descarta estaciones/terminales pero CONSERVA bares
  legítimos (Bar Pepe, Pub Fiction, Metropolitan Club). Caché v8.
- Build OK. Push pendiente.

### ✅ QA #5 + diseño chips
- Verifiqué modo día/noche: Barcelona 46 imperdibles vs 35 bares. Funciona.
- PERO detecté ruido: "Estació de Barcelona - Sants" (estación de tren) aparecía como bar.
- ARREGLO: filtro reforzado en Photon que descarta estaciones/aeropuertos/paradas/terminales
  por key (public_transport, station) y por nombre (estación, airport, terminal, metro...).
  Caché v7.
- DISEÑO: chips de destinos populares ahora con emoji icónico (🇪🇸 Madrid, 🗼 Tokio,
  🏔️ Cusco, 🏛️ Roma, 🏖️ Cartagena, 🗽 Nueva York). Más visual y atractivo.
- Build OK. Push pendiente.

### ✅ Visión 360: presupuesto conectado con vuelos reales
- VERIFICADO v6: Seúl 0→20 restaurantes, Atenas 2→29, Vancouver 1→28, Oslo 6→23. ¡Resuelto!
  (Algunas tardan ~11s en 1ª carga porque esperan a Overpass; se cachea y la 2ª es instantánea.
  Decisión de producto: priorizar SIEMPRE tener datos sobre 2-3s de diferencia.)
- NUEVO en presupuesto: cada destino ahora tiene 2 botones: "🗺️ Planear" (itinerario) y
  "✈️ Ver vuelos" (abre Google Flights al destino). Cierra el círculo 360: presupuesto →
  vuelo real → itinerario. Traducido a 4 idiomas.
- Build OK. Push pendiente.

### ✅ QA #4 — Restaurantes vacíos en varias ciudades
- QA AMPLIO (6 ciudades): detecté restaurantes bajo/vacío en Seúl (0), Atenas (2),
  Vancouver (1), Oslo (6). Mal para un viajero que busca dónde comer.
- CAUSA: Overpass trae 40 restaurantes pero a veces se pasa del tope 8s y se descarta;
  Photon "restaurant" solo traía 2 en Seúl.
- ARREGLO: (1) tope Overpass 8s→11s (los restaurantes son datos densos que valen). (2)
  Más términos de comida en Photon: food, grill, bbq, kitchen, bistro, diner (bbq solo
  ya trae 20 en Seúl). También más términos para cafés (bakery, tea) y bares (lounge,
  brewery). Caché v6.
- VALIDÉ el módulo de presupuesto con casos reales: 10M COP/7d/Europa → Estambul $1340,
  Lisboa $1410, Madrid $1500 (números con sentido). Lógica correcta.
- Build OK. Push pendiente.

### ✅ Diseño + UX: emojis y recordar viaje
- VERIFICADO velocidad tras tope 8s: Hanoi 13.3s→8.9s, Lagos/Tbilisi/Kioto 1-1.6s. OK.
- DISEÑO: cada parada del itinerario ahora muestra emoji de su categoría (🖼️🍽️☕🍸🏰⛪🌳)
  para identificarla de un vistazo. Más visual y claro.
- UX (pensando como usuario): la app ahora RECUERDA tu último viaje. Si cierras y
  vuelves, restaura automáticamente la última ciudad que estabas viendo (localStorage).
  Antes se perdía todo al cerrar — frustrante para un viajero.
- Build OK. Push pendiente.
- NOTA: no usé el navegador Chrome para QA visual porque el usuario duerme y podría
  interferir con sus pestañas; QA por API y revisión de código.

### ✅ QA #3 — Velocidad tope 8s + diseño detalle
- VERIFICADO v5: Cartagena 13.7s→0.7s (cacheada). Pero Hanoi (nueva) aún 13.3s
  porque Promise.all esperaba a Overpass lento.
- ARREGLO: a Overpass le damos máx 8s extra (Promise.race con timeout); Photon
  (rápido, 35-56 lugares) siempre se espera. Si Overpass tarda más, devolvemos ya.
  Ninguna ciudad debería pasar de ~8-9s en su primera carga; instantánea si cacheada.
- DISEÑO: detalle de lugar sin foto ahora muestra degradado azul + emoji según
  categoría (🖼️ museo, 🍽️ restaurante, ☕ café, 🍸 bar, 🏰 castillo, ⛪ templo…)
  en vez del 📷 genérico. Más atractivo.
- Build OK. Push pendiente.

### ✅ QA #2 — Velocidad: fuentes en paralelo
- VERIFICADO v4 en prod: Marrakech 21, Bali 28, Cartagena 38, Sydney 27 imperdibles. ¡Resuelto!
- PERO como usuario noté: Cartagena tardó 13.7s (Overpass lento + Photon secuencial DESPUÉS).
- ARREGLO: ahora Overpass y Photon corren EN PARALELO desde el inicio (Promise.all),
  Overpass timeout bajado a 9s. Si Overpass tarda, Photon ya viene en camino → mucho
  más rápido. Se unen sin duplicar. Caché v5. Build OK.

### ✅ QA #1 — Más lugares en ciudades con pocos resultados
- PROBÉ como usuario: Marrakech salía con 1 imperdible, Cartagena 4, Bali 7. Decepcionante.
- CAUSA: Overpass con timeout corto (9s) fallaba en algunas ciudades, y el respaldo
  Photon usaba `q=a` (traía casi nada).
- ARREGLOS: (1) Overpass timeout 9→14s y 4 espejos. (2) "imperdibles" ahora incluye
  templos/mezquitas/iglesias notables, theme_park, zoo, fort (atracciones top en
  muchas culturas). (3) Photon respaldo reescrito: busca por términos descriptivos
  (monument, palace, mosque, temple…) cerca del punto, en vez de q=a. (4) Filtro que
  descarta parkings/calles/paradas. (5) Caché subida a v4 (invalida la vieja con pocos
  lugares). (6) Complemento Photon se activa con <15 (antes <10).
- VERIFICADO simulación: Marrakech imperdibles 1→28. Build OK. Push pendiente.

### ✅ [#5] Módulo de Presupuesto de viaje — COMPLETADO
- Creado `lib/presupuesto.js`: 30 destinos (Sudamérica, Norte/Centroamérica, Europa, Asia)
  con costo de vuelo i/v desde Colombia + costo diario por persona. Función
  `calcularDestinos` (qué cabe en el presupuesto) y `diasPosibles`.
- Creado `components/Presupuesto.js`: modal donde el usuario pone presupuesto
  (COP/USD/MXN/EUR), días, personas y región. Muestra destinos que caben (✓ verdes)
  ordenados por precio, con desglose expandible: ✈️ vuelo, 🏨 hospedaje, 🍽️ comida,
  🚇 transporte, 🎟️ extras. Dice cuánto te sobra/falta y para cuántos días alcanza.
  Botón "Planear [ciudad]" que lleva al itinerario de esa ciudad.
- Traducciones del presupuesto en los 4 idiomas (ES/EN/PT/FR).
- Botón verde destacado en la pantalla de inicio: "💰 ¿Adónde viajar con mi presupuesto?".
- Build OK. Commit pendiente de push.
- DECISIÓN: costos son promedios orientativos (gama media). Aviso claro al usuario
  de que el precio real de vuelos se confirma con el detector. Conecta ambos mundos
  (detector de vuelos + planificador) que es la visión 360.

### ⏳ Iniciando sesión nocturna…
- Configurado el PC para no suspenderse.
- Creado este archivo de seguimiento.
