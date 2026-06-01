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
