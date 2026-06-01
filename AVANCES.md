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
