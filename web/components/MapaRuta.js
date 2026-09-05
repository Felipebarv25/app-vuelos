"use client";
// Mapa de un viaje multiparada.
//
// No reutiliza Mapa.js a proposito. Aquel esta hecho para la ruta de UN dia
// dentro de UNA ciudad: rota la longitud con el scroll, abre fotos de cada
// lugar, pinta el hotel y hace zoom 13 sobre un punto. Aqui hace falta lo
// contrario: mirar paises enteros, numerar las paradas en el orden del viaje
// y unirlas con una linea. Meter los dos casos en un componente habria sido
// una lista de props excluyentes.
//
// El encuadre lo manda la ruta: el mapa se ajusta a las ciudades del viaje,
// que es lo que el usuario pidio ("filtrado por la zona en la que me estoy
// enfocando para cada viaje").
import { useEffect, useRef, useState } from "react";

// El fondo pasa de RASTER a VECTORIAL, y de ahi salen cuatro cosas de golpe.
//
// Hasta ahora eran imagenes: cada tile una foto del mapa con los nombres YA
// pintados encima. Eso trae tres problemas que no se pueden arreglar por
// separado, porque son el mismo:
//
//   · Los nombres se ven borrosos. Es texto dentro de un bitmap; al inclinar
//     la vista se estira como cualquier foto. No hay ajuste que lo salve.
//   · Los nombres estan TUMBADOS sobre el suelo, porque son parte del suelo.
//   · Los colores son los del callejero de OSM — gris y beige —, no los de un
//     planeta: sin verde donde hay bosque ni palido donde hay desierto.
//
// Con tiles vectoriales el navegador dibuja el texto de verdad: nitido a
// cualquier zoom y, por defecto, de cara a la camara aunque el mapa este
// inclinado. Y el estilo trae lo que faltaba: relieve fisico (ne2_shaded, que
// es Natural Earth sombreado), fronteras (boundary_2 y boundary_3) y nombres
// de mares y oceanos (water_name).
//
// OpenFreeMap sirve el estilo "liberty" sin API key ni registro, que es lo que
// lo hace viable aqui: cualquier otro proveedor vectorial decente (MapTiler,
// Stadia, Mapbox) pide una clave.
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";

// Fondo del contenedor, DETRAS del globo.
//
// Era el azul del agua del estilo (#a0c8f0) porque con proyeccion plana el
// mapa cubria todo el rectangulo y el color solo asomaba mientras cargaban
// los tiles. Con el globo ya no: fuera de la esfera hay fondo de verdad, y un
// azul de mar ahi hacia que el planeta pareciera un recorte pegado sobre otro
// mar — el borde del agua no contrastaba con nada. Un gris muy claro y neutro
// deja que la esfera se lea como esfera.
const FONDO = "#eef2f7";

function asegurarCss() {
  if (typeof document === "undefined") return;
  if (document.getElementById("maplibre-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

export default function MapaRuta({ paradas = [], alto = 320, textoFallo = "" }) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef([]);
  // Si el fondo no llega. NO es "el mapa fallo": las paradas se ven igual,
  // que es la parte que importa.
  const [sinFondo, setSinFondo] = useState(false);
  const lineaRef = useRef(null);

  // Solo las paradas que tienen coordenadas. Una ciudad sin geocodificar no
  // se puede pintar, y saltarsela es mejor que no pintar el mapa entero.
  const puntos = paradas
    .map((p, i) => ({ ...p, n: i + 1 }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  // Clave de contenido: si no cambia, no se vuelve a dibujar. Sin esto cada
  // tecla en "noches" repintaba todos los marcadores.
  const clave = puntos.map((p) => `${p.n}:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join("|");

  useEffect(() => {
    let cancelado = false;

    async function dibujar() {
      if (!ref.current || puntos.length === 0) return;
      asegurarCss();
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelado || !ref.current) return;

      if (!mapaRef.current) {
        const mapa = new maplibregl.Map({
          container: ref.current,
          style: ESTILO,
          center: [puntos[0].lon, puntos[0].lat],
          zoom: 3,
          // INCLINADO DE ENTRADA.
          //
          // Plano se lee como un plano; inclinado se lee como un globo, y la
          // ruta cruzando el oceano se ve ir hacia el horizonte. El usuario lo
          // encontro girandolo a mano y pidio que fuera asi al abrir.
          //
          // 48 grados y no el maximo: pasados los 55 el horizonte se come
          // media tarjeta y las etiquetas del fondo se amontonan.
          // Sigue siendo el punto de partida, no una jaula: se puede enderezar
          // arrastrando con el boton derecho.
          // GLOBO, no un plano inclinado.
          //
          // Antes se simulaba la esfera con pitch: el mapa seguia siendo una
          // hoja plana vista de canto, y se notaba — la superficie terminaba
          // en un borde recto y el conjunto se leia como un cuadro. maplibre
          // 5 trae proyeccion de globo real, asi que el planeta es una esfera
          // y el horizonte curva solo.
          //
          // Con globo, el pitch baja: la esfera ya aporta la profundidad que
          // antes daba la inclinacion, y a 48 grados sobre una esfera el polo
          // se va de cuadro.
          projection: { type: "globe" },
          pitch: 25,
          bearing: -12,
          cooperativeGestures: true,
          // El mundo NO se repite. Al alejar el zoom, maplibre pinta copias del
          // planeta a los lados: se veian TRES mundos con la ruta dibujada tres
          // veces. Con una sola copia el encuadre es el de un globo y no el de
          // un papel pintado.
          renderWorldCopies: false,
        });
        mapaRef.current = mapa;
        mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        // Zoom con gesto cooperativo, no desactivado.
        //
        // Estaba desactivado del todo porque capturar el scroll dentro de una
        // tarjeta larga deja al usuario atrapado en el mapa. Pero eso quitaba
        // tambien el zoom, que es justo lo que hace util un mapa de ruta.
        //
        // maplibre trae la solucion buena: el scroll a secas pasa a la pagina
        // y el zoom pide ctrl/cmd (o dos dedos en el trackpad), con un cartel
        // que lo explica la primera vez.
        mapa.scrollZoom.enable();
        mapa.scrollZoom.setWheelZoomRate(1 / 450);
        // Contabilidad del fondo, solo para poder decirlo si no llega. Un
        // error de tile NO es un fallo del mapa: la version anterior tapaba
        // con un cartel un mapa que funcionaba, escondiendo las paradas.
        let tilesOk = 0;
        mapa.on("data", (e) => {
          // Con el estilo VECTORIAL este evento ya no siempre trae `e.tile`,
          // asi que con la comprobacion vieja el aviso se quedaba puesto
          // encima de un mapa que estaba pintando perfectamente. Se ignora
          // solo la fuente de la propia ruta, que no es el fondo.
          if (e?.dataType !== "source" || e?.sourceId === "ruta") return;
          // El primer tile retira el aviso. Antes lo hacia un temporizador,
          // y eso volvia a atar la verdad de lo que se ve a un plazo elegido a
          // ojo: si el mapa tardaba mas de la cuenta, el aviso se quedaba
          // puesto encima de un mapa perfectamente cargado.
          if (tilesOk++ === 0) setSinFondo(false);
        });
        mapa.on("error", (e) => {
          const msg = e?.error?.message || "";
          if (msg && !/tile|fetch|load/i.test(msg)) console.warn("[MapaRuta]", msg);
        });
        // Si pasados diez segundos no ha entrado un solo tile, se dice, pero
        // debajo del mapa y sin tapar nada. Lo retira el propio tile cuando
        // llegue, por lento que sea.
        setTimeout(() => {
          if (cancelado) return;
          // Dos formas de saberlo, y basta con una. El contador de eventos se
          // ha equivocado ya dos veces al cambiar de tipo de mapa; preguntarle
          // al propio maplibre es lo que no depende de la forma del evento.
          const cargado = tilesOk > 0 || mapaRef.current?.areTilesLoaded?.();
          setSinFondo(!cargado);
        }, 10000);
      }
      const mapa = mapaRef.current;
      mapa.resize();

      // --- Lo que NO necesita el estilo: marcadores y encuadre --------------
      //
      // Esto va primero y sin esperar a nada, y no es un detalle de orden.
      // El dibujado colgaba entero del evento "load" de maplibre, y donde ese
      // evento no llega — probado: un mapa minimo en el mismo navegador se
      // queda con isStyleLoaded()=false para siempre — la tarjeta mostraba un
      // rectangulo gris sin una sola parada. Los marcadores y el encuadre no
      // dependen del estilo: se pintan ya, y si el mapa base no llega al menos
      // se ve el viaje.
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];

      for (const p of puntos) {
        const iso = String(p.pais || "").toLowerCase();
        const conBandera = /^[a-z]{2}$/.test(iso);
        const el = document.createElement("div");
        // CHINCHE, no circulo.
        //
        // Eran discos numerados flotando sobre el mapa: leen bien pero no
        // dicen nada. Un chinche clavado es lo que uno hace de verdad sobre
        // un mapa cuando marca a donde va, y de paso resuelve dos cosas que
        // el circulo hacia mal: senala un PUNTO exacto — la aguja apunta a la
        // coordenada, el circulo la tapaba — y da profundidad, porque tiene
        // sombra propia y se ve apoyado en vez de pegado.
        //
        // La aguja va en el ancla del marcador (abajo), asi que el marcador se
        // desplaza hacia arriba para que la punta caiga en la coordenada.
        const CABEZA = 13;   // radio de la cabeza del chinche
        const AGUJA = 15;    // largo de la aguja
        const ancho = CABEZA * 2 + 4;
        const alto = CABEZA * 2 + AGUJA + 4;
        el.innerHTML = `
          <svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" style="display:block;overflow:visible">
            <defs>
              <radialGradient id="ch${p.n}" cx="35%" cy="28%" r="75%">
                <stop offset="0%" stop-color="#2aa79b"/>
                <stop offset="60%" stop-color="#0f766e"/>
                <stop offset="100%" stop-color="#08514c"/>
              </radialGradient>
              ${conBandera ? `<clipPath id="cab${p.n}"><circle cx="${ancho / 2}" cy="${CABEZA + 2}" r="${CABEZA}"/></clipPath>` : ""}
            </defs>
            <ellipse cx="${ancho / 2 + 1}" cy="${alto - 2}" rx="4.5" ry="1.8" fill="#000" opacity="0.22"/>
            <path d="M${ancho / 2} ${CABEZA + 2} L${ancho / 2} ${alto - 3}" stroke="#c9d4d3" stroke-width="2" stroke-linecap="round"/>
            <path d="M${ancho / 2} ${CABEZA + 2} L${ancho / 2} ${alto - 3}" stroke="#8fa3a1" stroke-width="0.8" stroke-linecap="round"/>
            ${conBandera ? `
              <!-- LA BANDERA DEL PAIS dentro de la cabeza.
                   slice y no meet: la bandera LLENA el circulo en vez de
                   dejar franjas vacias a los lados. Encima va un velo oscuro
                   porque el numero tiene que leerse igual sobre la bandera
                   de Japon que sobre la de Colombia, y sin el desaparecia
                   en las claras. -->
              <circle cx="${ancho / 2}" cy="${CABEZA + 2}" r="${CABEZA}" fill="#0f766e"/>
              <image href="https://flagcdn.com/w80/${iso}.png" clip-path="url(#cab${p.n})"
                     x="${ancho / 2 - CABEZA}" y="${CABEZA + 2 - CABEZA}"
                     width="${CABEZA * 2}" height="${CABEZA * 2}"
                     preserveAspectRatio="xMidYMid slice"/>
              <circle cx="${ancho / 2}" cy="${CABEZA + 2}" r="${CABEZA}" fill="#000" opacity="0.34"/>
              <circle cx="${ancho / 2}" cy="${CABEZA + 2}" r="${CABEZA}" fill="none" stroke="#fff" stroke-width="2"/>
            ` : `
              <circle cx="${ancho / 2}" cy="${CABEZA + 2}" r="${CABEZA}" fill="url(#ch${p.n})" stroke="#fff" stroke-width="2"/>
              <ellipse cx="${ancho / 2 - CABEZA * 0.32}" cy="${CABEZA + 2 - CABEZA * 0.38}" rx="${CABEZA * 0.34}" ry="${CABEZA * 0.24}" fill="#fff" opacity="0.35"/>
            `}
            <text x="${ancho / 2}" y="${CABEZA + 2}" text-anchor="middle" dominant-baseline="central"
                  font-size="12" font-weight="800" fill="#fff"
                  style="font-family:inherit;paint-order:stroke" stroke="#0b3d3a" stroke-width="2.4">${p.n}</text>
          </svg>`;
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lon, p.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
              `<div style="font-weight:800;font-size:12.5px;color:#052b28">${p.n}. ${p.ciudad}</div>` +
                (p.iata ? `<div style="font-size:11px;color:#64748b">${p.iata}</div>` : "")
            )
          )
          .addTo(mapa);
        marcadoresRef.current.push(m);
      }

      if (puntos.length > 1) {
        const b = new maplibregl.LngLatBounds();
        puntos.forEach((p) => b.extend([p.lon, p.lat]));
        // fitBounds conserva la inclinacion si no se le pasa otra, pero se
        // deja explicito para que nadie la pierda sin darse cuenta.
        mapa.fitBounds(b, {
          padding: 56,
          maxZoom: 8,
          duration: 600,
          pitch: mapa.getPitch(),
          bearing: mapa.getBearing(),
        });
      } else {
        mapa.flyTo({ center: [puntos[0].lon, puntos[0].lat], zoom: 5, duration: 600 });
      }

      // --- Lo que SI necesita el estilo: la linea del recorrido -------------
      // addSource/addLayer solo funcionan con el estilo cargado. Se intenta
      // cuando ya lo esta y, si no, se reintenta un rato corto; si nunca
      // llega, el mapa se queda con sus paradas y sin linea, que es mucho
      // mejor que quedarse sin nada.
      lineaRef.current = () => {
        if (cancelado || !mapaRef.current) return;
        // Preguntar antes de quitar. El try/catch no bastaba: maplibre no
        // lanza al quitar una capa que no existe, emite un evento "error", y
        // eso llenaba la consola de "Cannot remove non-existing layer".
        if (mapaRef.current.getLayer("linea-ruta")) mapaRef.current.removeLayer("linea-ruta");
        if (mapaRef.current.getSource("ruta")) mapaRef.current.removeSource("ruta");
        if (puntos.length < 2) return;
        mapaRef.current.addSource("ruta", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: puntos.map((p) => [p.lon, p.lat]) },
          },
        });
        // La linea, DEBAJO de los nombres.
        //
        // Por defecto una capa nueva va encima de todo, y con un estilo
        // vectorial eso significa encima de los nombres de paises y mares:
        // el trayecto tachaba justo el texto que se acaba de poder leer. Se
        // inserta antes de la primera capa de simbolos.
        const capas = mapaRef.current.getStyle()?.layers || [];
        const primerTexto = capas.find((c) => c.type === "symbol")?.id;
        mapaRef.current.addLayer({
          id: "linea-ruta",
          type: "line",
          source: "ruta",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#0f766e",
            "line-width": 2.5,
            "line-opacity": 0.8,
            "line-dasharray": [2, 1.6],
          },
        }, primerTexto);

        // --- AEROPUERTOS Y LUGARES, visibles antes de tener que hacer zoom --
        //
        // El estilo liberty YA trae los aeropuertos, los puntos de interes y
        // las calles; el problema es a que zoom aparecen. De fabrica:
        //
        //     airport (aerodrome_label)  desde zoom 10
        //     poi_r1  (los mejor puntuados)      15
        //     poi_r7 / poi_r20                   16 / 17
        //
        // Y este mapa abre encuadrando la ruta entera, que en un viaje a
        // Europa es zoom 4. O sea que estaba todo ahi y no se veia NUNCA sin
        // ir a buscarlo. Se bajan los umbrales y se le da color propio al
        // aeropuerto, que es el dato que de verdad importa en un planificador
        // de vuelos: donde se aterriza.
        ajustarDetalle(mapaRef.current);
      };

      /**
       * Baja los zooms minimos del estilo y resalta los aeropuertos.
       *
       * Todo entre try/catch y comprobando que la capa exista: si OpenFreeMap
       * cambia el estilo y alguna deja de llamarse asi, el mapa se queda como
       * estaba en vez de romperse.
       */
      function ajustarDetalle(mapa) {
        const bajar = (id, min) => {
          try { if (mapa.getLayer(id)) mapa.setLayerZoomRange(id, min, 24); } catch {}
        };
        // Lugares de interes: los mejor puntuados desde bastante antes.
        bajar("poi_r1", 12);
        bajar("poi_r7", 14);
        bajar("poi_transit", 12);
        // El recinto y las pistas del aeropuerto, en cuanto se acerca uno.
        bajar("aeroway_fill", 9);
        bajar("aeroway_runway", 9);
        // La etiqueta del aeropuerto: es la que lleva el codigo IATA.
        bajar("airport", 5);

        // ESCUDOS DE CARRETERA FUERA.
        //
        // Son los recuadros blancos con "M-40", "R-3", "M-501" que aparecen
        // al acercarse a una ciudad. En un mapa de carretera son utiles; aqui
        // se busca por donde pasa el viaje, no por que autovia se llega, y
        // llenaban Madrid de cajitas encima de los nombres de barrio.
        //
        // Se van los ESCUDOS, no los nombres de calle: highway-name-* se
        // queda, que es lo que si se pidio ver.
        for (const id of ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]) {
          try { if (mapa.getLayer(id)) mapa.setLayoutProperty(id, "visibility", "none"); } catch {}
        }

        try {
          if (mapa.getLayer("airport")) {
            // Coral de marca y halo blanco: el unico punto del mapa que no es
            // teal ni gris, para que se encuentre de un vistazo entre los
            // nombres de ciudad.
            mapa.setPaintProperty("airport", "text-color", "#b8452a");
            mapa.setPaintProperty("airport", "text-halo-color", "#ffffff");
            mapa.setPaintProperty("airport", "text-halo-width", 1.6);
            mapa.setLayoutProperty("airport", "text-size", 11);
            // Que se lea el IATA aunque el nombre no quepa: "Barajas (MAD)".
            //
            // `to-string` en cada trozo y no solo `get`: el operador concat
            // exige cadenas, y get devuelve un Value sin tipar. Sin la
            // conversion maplibre puede rechazar la expresion entera, y el
            // sintoma seria mudo — la capa se queda con su texto de siempre y
            // parece que el cambio no se aplico.
            const nombreLocal = ["to-string", ["coalesce", ["get", "name:es"], ["get", "name"], ""]];
            mapa.setLayoutProperty("airport", "text-field", [
              "case",
              ["has", "iata"],
              ["concat", nombreLocal, " (", ["to-string", ["get", "iata"]], ")"],
              nombreLocal,
            ]);
            mapa.setLayoutProperty("airport", "text-allow-overlap", false);
            mapa.setLayoutProperty("airport", "icon-allow-overlap", true);
          }
        } catch {}
      }

      let intentos = 0;
      const cuandoHayaEstilo = () => {
        if (cancelado || !mapaRef.current) return;
        if (mapaRef.current.isStyleLoaded()) { try { lineaRef.current(); } catch {} return; }
        if (intentos++ < 50) setTimeout(cuandoHayaEstilo, 120);
      };
      cuandoHayaEstilo();
    }

    dibujar();
    return () => { cancelado = true; };
    // `clave` resume el contenido: ver arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  useEffect(
    () => () => {
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    []
  );

  if (puntos.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={ref}
        // El mar TAMBIEN en el contenedor, no solo en la capa del mapa.
        //
        // La capa de fondo cubre lo que pinta maplibre, pero con la vista
        // inclinada queda un triangulo por encima del horizonte que el canvas
        // no pinta, y ahi se veia el blanco de la pagina. Pintando el div se
        // acaba el problema venga de donde venga: del zoom, del pitch o de que
        // los tiles tarden.
        style={{ height: alto, backgroundColor: FONDO }}
        className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
      />
      {/* Si el fondo no llega se dice DEBAJO, nunca encima. El cartel que
          tapaba el mapa escondia tambien las paradas, que son lo que de
          verdad hace falta ver. */}
      {sinFondo && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">{textoFallo}</p>
      )}
    </div>
  );
}
