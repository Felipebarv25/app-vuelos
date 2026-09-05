"use client";
// El mapa de la ruta: plano, encuadrado a tu viaje y con cada parada tocable.
//
// QUE CAMBIO Y POR QUE (reescritura 2026-09-05)
//
// La version anterior era un GLOBO 3D inclinado. Se veia bien en una captura
// y era mala para trabajar: arrastrar rotaba el planeta en vez de mover el
// mapa, las paradas europeas se amontonaban en un punto imposible de tocar, y
// una parada sin coordenadas simplemente no existia — Birmingham desaparecia
// de un viaje de once paradas sin que nada lo dijera.
//
// Ahora manda el uso:
//
//   - Mercator plano. Arrastrar desplaza.
//   - Al abrir, el mapa se encuadra SOLO a todas las paradas. Nadie deberia
//     tener que buscar su propio viaje.
//   - Un chinche numerado por parada, con la bandera de su pais, que se puede
//     tocar y abre su ficha.
//   - Las paradas que caen encima se separan en abanico en vez de taparse.
//   - Lo que no se puede ubicar SE DICE, debajo del mapa, en vez de callarse.

import { useEffect, useMemo, useRef, useState } from "react";
import { ubicarPorIATA } from "@/lib/coordsAeropuerto";

// OpenFreeMap sirve el estilo "liberty" sin API key ni registro, que es lo que
// lo hace viable aqui: cualquier otro proveedor vectorial decente (MapTiler,
// Stadia, Mapbox) pide una clave.
const ESTILO = "https://tiles.openfreemap.org/styles/liberty";

// Fondo mientras cargan los tiles. Gris muy claro y no azul mar: si tarda, un
// rectangulo azul se lee como "mapa roto en mitad del oceano".
const FONDO = "#eef2f7";

const TEAL = "#0f766e";

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

// OJO con Number(): Number(null) es 0 y Number("") tambien, asi que
// Number.isFinite(Number(null)) devuelve TRUE. Una parada con lat: null
// —que es justo el caso que este mapa tiene que detectar— pasaba el filtro y
// reventaba despues en lat.toFixed(). Se rechaza lo vacio antes de convertir.
const esNum = (v) =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

/**
 * Separa en abanico las paradas que caerian en el mismo sitio.
 *
 * En un viaje europeo, Madrid, Londres y Birmingham entran en pocos pixeles al
 * encuadrar la ruta entera, y los chinches se tapaban unos a otros: el de
 * arriba se podia tocar y los de abajo no existian para el raton.
 *
 * En vez de agrupar en un cluster con un numero —que esconde el dato y obliga
 * a un clic mas— se abren en circulo alrededor de su centro. El numero de
 * parada sigue visible en todos, que es lo que se viene a leer, y la aguja del
 * chinche sigue apuntando a su sitio real.
 *
 * @param {Array} puntos  paradas con lat/lon
 * @param {Function} aPixel  (lng,lat) -> {x,y}
 * @param {number} radio  distancia en px por debajo de la cual se considera choque
 */
function separarChoques(puntos, aPixel, radio = 34) {
  const grupos = [];
  for (const p of puntos) {
    const pos = aPixel(p.lon, p.lat);
    const g = grupos.find((x) => Math.hypot(x.x - pos.x, x.y - pos.y) < radio);
    if (g) g.items.push(p);
    else grupos.push({ x: pos.x, y: pos.y, items: [p] });
  }
  const desvios = new Map();
  for (const g of grupos) {
    if (g.items.length < 2) continue;
    const r = 16 + g.items.length * 3;
    g.items.forEach((p, i) => {
      const ang = (2 * Math.PI * i) / g.items.length - Math.PI / 2;
      desvios.set(p.n, [Math.cos(ang) * r, Math.sin(ang) * r]);
    });
  }
  return desvios;
}

export default function MapaRuta({
  paradas = [],
  alto = 420,
  textoFallo = "No pudimos cargar el mapa.",
  // Parada resaltada desde la lista del itinerario. Al cambiar, el mapa vuela
  // hasta ella y abre su ficha.
  seleccionada = null,
  // Aviso hacia la lista cuando se toca un chinche.
  onSeleccionar = null,
  lang = "es",
  t = (k) => k,
}) {
  const ref = useRef(null);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef([]);
  const popupRef = useRef(null);
  const lineaRef = useRef(null);
  const encuadrarRef = useRef(null);
  const [fallo, setFallo] = useState(false);
  const [ubicadas, setUbicadas] = useState(null); // paradas ya resueltas por IATA

  // Resolver coordenadas que falten ANTES de dibujar. Es asincrono porque la
  // tabla de aeropuertos se pide solo si hace falta.
  useEffect(() => {
    let vivo = true;
    ubicarPorIATA(paradas).then((r) => { if (vivo) setUbicadas(r); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify((paradas || []).map((p) => [p.ciudad, p.iata, p.lat, p.lon]))]);

  const lista = ubicadas || paradas || [];

  // El numero que se pinta es el de la parada en el ITINERARIO, no el de la
  // lista filtrada: si la parada 4 no se puede ubicar, la siguiente sigue
  // siendo la 5 en el mapa y en la lista.
  const puntos = useMemo(
    () =>
      lista
        .map((p, i) => ({ ...p, n: i + 1 }))
        .filter((p) => esNum(p.lat) && esNum(p.lon))
        .map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) })),
    [lista]
  );
  const sinUbicar = useMemo(
    () => lista.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => !esNum(p.lat) || !esNum(p.lon)),
    [lista]
  );

  const clave = puntos.map((p) => `${p.n}:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join("|");

  useEffect(() => {
    let cancelado = false;

    async function dibujar() {
      if (!ref.current || puntos.length === 0) return;
      try {
        asegurarCss();
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelado || !ref.current) return;

        if (!mapaRef.current) {
          mapaRef.current = new maplibregl.Map({
            container: ref.current,
            style: ESTILO,
            center: [puntos[0].lon, puntos[0].lat],
            zoom: 3,
            // PLANO. La proyeccion de globo se retiro: era bonita y estorbaba.
            // Arrastrar tiene que mover el mapa, no girar un planeta.
            //
            // maplibre 5 NO acepta `projection` en el constructor —no esta en
            // sus opciones por defecto y se ignora en silencio—, asi que
            // mercator se deja explicito mas abajo con setProjection().
            minZoom: 1,
            maxZoom: 16,
            // Sin copias del mundo: al alejar se pintaban tres planetas con la
            // ruta dibujada tres veces.
            renderWorldCopies: false,
            // GESTOS. Arrastrar tiene que mover el mapa SIEMPRE.
            //
            // Aqui vivia `cooperativeGestures: true` y bloqueaba justo eso.
            // Su letra pequena, leida en el codigo de maplibre 5.24 y no
            // supuesta:
            //
            //   _shouldBePrevented()  minTouches = 2  -> un dedo NO mueve el
            //                                           mapa, hacen falta dos
            //   wheel_zoom            exige ctrl/cmd  -> y en un trackpad el
            //                                           gesto de arrastrar ES
            //                                           la rueda
            //
            // O sea: en pantalla tactil y en trackpad el mapa se sentia
            // trabado. Lo que se queria evitar —bajar por el itinerario y
            // cambiar el zoom sin querer— se resuelve mas abajo con la rueda
            // sola, sin tocar el arrastre.
            scrollZoom: false,
            // Un mapa plano no se gira: rotarlo solo desordena los nombres.
            dragRotate: false,
            touchPitch: false,
            attributionControl: { compact: true },
            // FLUIDEZ AL ACERCAR.
            //
            // Al hacer zoom, maplibre estira el tile del nivel anterior
            // mientras baja el nuevo: eso es lo que se ve pixelado. No se
            // puede evitar del todo, pero si acortarlo.
            //
            //   fadeDuration 0     el tile nuevo aparece en cuanto llega, sin
            //                      300 ms de fundido encima del borroso.
            //   maxTileCacheSize   guarda mas tiles ya descargados, asi que
            //                      volver a un nivel es instantaneo en vez de
            //                      volver a pedirlo.
            //   refreshExpiredTiles: false   no revalida lo que ya tiene.
            fadeDuration: 0,
            maxTileCacheSize: 300,
            refreshExpiredTiles: false,
          });
          mapaRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
          // Un solo error de tile no significa que el mapa haya fallado; el
          // aviso sale mas abajo y solo si no llega NADA.
          mapaRef.current.on("error", () => {});

          // LA RUEDA SE ENCIENDE AL USAR EL MAPA.
          //
          // Mientras nadie lo ha tocado, la rueda hace scroll de la PAGINA,
          // que es lo que quiere quien va bajando por el itinerario. En
          // cuanto se pulsa dentro del mapa pasa a hacer zoom, y al salir el
          // puntero vuelve a ser scroll. El ARRASTRE no depende de esto en
          // ningun momento: esa era la trampa de cooperativeGestures.
          const cont = mapaRef.current.getContainer();
          const rueda = (on) => {
            try {
              mapaRef.current?.scrollZoom[on ? "enable" : "disable"]();
              cont.dataset.rueda = on ? "zoom" : "pagina";
            } catch {}
          };
          rueda(false);
          cont.addEventListener("pointerdown", () => rueda(true));
          cont.addEventListener("pointerleave", () => rueda(false));
          try { mapaRef.current.touchZoomRotate.disableRotation(); } catch {}

          // Y publica donde quedo la vista. Mismo motivo que data-proyeccion:
          // sin esto, la unica forma de saber si el mapa se deja arrastrar es
          // mirarlo, y hay entornos donde no se puede mirar.
          const publicarVista = () => {
            try {
              const c = mapaRef.current.getCenter();
              cont.dataset.centro = c.lng.toFixed(3) + "," + c.lat.toFixed(3);
              cont.dataset.zoom = mapaRef.current.getZoom().toFixed(2);
            } catch {}
          };
          mapaRef.current.on("moveend", publicarVista);
          publicarVista();
        }

        const mapa = mapaRef.current;
        mapa.resize();

        // ---- ENCUADRE A TODA LA RUTA --------------------------------------
        //
        // Lo primero que se ve tiene que ser el viaje entero. Se guarda en un
        // ref para que el boton "Ver toda la ruta" repita exactamente esto.
        encuadrarRef.current = (duracion = 600) => {
          if (!mapaRef.current || puntos.length === 0) return;
          if (puntos.length === 1) {
            mapaRef.current.easeTo({ center: [puntos[0].lon, puntos[0].lat], zoom: 6, duration: duracion });
            return;
          }
          const b = puntos.reduce(
            (a, p) => [
              Math.min(a[0], p.lon), Math.min(a[1], p.lat),
              Math.max(a[2], p.lon), Math.max(a[3], p.lat),
            ],
            [180, 90, -180, -90]
          );
          mapaRef.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
            padding: 60,
            maxZoom: 8,
            duration: duracion,
          });
        };
        encuadrarRef.current(0);

        // ---- CHINCHES ------------------------------------------------------
        marcadoresRef.current.forEach((m) => m.remove());
        marcadoresRef.current = [];

        const desvios = separarChoques(puntos, (lon, lat) => mapa.project([lon, lat]));

        for (const p of puntos) {
          const iso = String(p.pais || "").toLowerCase();
          const conBandera = /^[a-z]{2}$/.test(iso);
          const el = document.createElement("div");
          el.setAttribute("role", "button");
          el.setAttribute("tabindex", "0");
          el.setAttribute("aria-label", `${p.n}. ${p.ciudad || ""}`);
          el.style.cursor = "pointer";

          const CABEZA = 14;
          const AGUJA = 15;
          const ancho = CABEZA * 2 + 4;
          const altoPin = CABEZA * 2 + AGUJA + 4;
          const cx = ancho / 2;
          const cy = CABEZA + 2;

          // El SVG va DENTRO de otro div, y no suelto.
          //
          // maplibre coloca cada marcador escribiendo un `transform:
          // translate(...)` en SU elemento. El efecto de hover escribia
          // `transform: scale(1.15)` en ese mismo elemento y BORRABA la
          // posicion: el chinche saltaba a la esquina superior izquierda con
          // solo pasar el raton por encima. La escala va en el hijo, que
          // maplibre no toca.
          const cuerpo = document.createElement("div");
          cuerpo.style.transition = "transform .12s ease";
          cuerpo.style.transformOrigin = "50% 100%";
          cuerpo.innerHTML = `
            <svg width="${ancho}" height="${altoPin}" viewBox="0 0 ${ancho} ${altoPin}" style="display:block;overflow:visible">
              <defs>
                ${conBandera ? `<clipPath id="cab${p.n}"><circle cx="${cx}" cy="${cy}" r="${CABEZA}"/></clipPath>` : ""}
              </defs>
              <ellipse cx="${cx + 1}" cy="${altoPin - 2}" rx="4.5" ry="1.8" fill="#000" opacity="0.22"/>
              <path d="M${cx} ${cy} L${cx} ${altoPin - 3}" stroke="#c9d4d3" stroke-width="2" stroke-linecap="round"/>
              <circle cx="${cx}" cy="${cy}" r="${CABEZA}" fill="${TEAL}"/>
              ${conBandera ? `<image href="https://flagcdn.com/w80/${iso}.png" clip-path="url(#cab${p.n})"
                     x="${cx - CABEZA}" y="${cy - CABEZA}" width="${CABEZA * 2}" height="${CABEZA * 2}"
                     preserveAspectRatio="xMidYMid slice"/>
              <circle cx="${cx}" cy="${cy}" r="${CABEZA}" fill="#000" opacity="0.34"/>` : ""}
              <circle class="aro" cx="${cx}" cy="${cy}" r="${CABEZA}" fill="none" stroke="#fff" stroke-width="2"/>
              <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
                    font-size="13" font-weight="800" fill="#fff"
                    style="font-family:inherit;paint-order:stroke" stroke="#0b3d3a" stroke-width="2.4">${p.n}</text>
            </svg>`;
          el.appendChild(cuerpo);

          // Hover: crece un poco y el aro se pone en coral, sin moverse.
          el.addEventListener("mouseenter", () => {
            cuerpo.style.transform = "scale(1.15)";
            el.querySelector(".aro")?.setAttribute("stroke", "#f4734d");
          });
          el.addEventListener("mouseleave", () => {
            cuerpo.style.transform = "";
            el.querySelector(".aro")?.setAttribute("stroke", "#fff");
          });

          const [dx, dy] = desvios.get(p.n) || [0, 0];
          const m = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [dx, dy] })
            .setLngLat([p.lon, p.lat])
            .addTo(mapa);

          const abrir = () => {
            popupRef.current?.remove();
            const noches = Number(p.noches) || 0;
            // focusAfterOpen: false.
            //
            // Por defecto maplibre mueve el FOCO al popup al abrirlo, y el
            // navegador desplaza la pagina para hacer visible lo enfocado: al
            // tocar una tarjeta del itinerario la pantalla saltaba arriba o
            // abajo sola. Filtrar el mapa no deberia mover al usuario de sitio.
            popupRef.current = new maplibregl.Popup({
              offset: 26,
              closeButton: true,
              maxWidth: "240px",
              focusAfterOpen: false,
            })
              .setLngLat([p.lon, p.lat])
              .setHTML(`
                <div style="font-family:inherit;min-width:140px">
                  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0f766e">
                    ${t("mapaParada")} ${p.n}
                  </div>
                  <div style="font-size:15px;font-weight:800;color:#0b3d3a;margin-top:2px">
                    ${(p.ciudad || "").replace(/</g, "&lt;")}
                  </div>
                  ${p.iata ? `<div style="font-size:12px;color:#64748b;margin-top:1px">${p.iata}</div>` : ""}
                  ${noches ? `<div style="font-size:12.5px;color:#334155;margin-top:4px">${noches} ${t("mapaNoches")}</div>` : ""}
                  ${p.ubicadaPorIATA ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">${t("mapaUbicadaPorIATA")}</div>` : ""}
                </div>`)
              .addTo(mapa);
            onSeleccionar?.(p.n);
          };
          el.addEventListener("click", abrir);
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
          });

          m._anduve = { n: p.n, abrir, lon: p.lon, lat: p.lat };
          marcadoresRef.current.push(m);
        }

        // ---- LINEA DE LA RUTA ---------------------------------------------
        //
        // Une las paradas EN ORDEN de itinerario. Las que no se pudieron
        // ubicar se saltan sin cortar el resto: la linea sigue contando el
        // viaje aunque a una parada le falte su coordenada.
        lineaRef.current = () => {
          if (cancelado || !mapaRef.current) return;
          const m2 = mapaRef.current;
          for (const id of ["linea-ruta", "linea-flechas"]) {
            if (m2.getLayer(id)) m2.removeLayer(id);
          }
          if (m2.getSource("ruta")) m2.removeSource("ruta");
          if (puntos.length < 2) return;

          m2.addSource("ruta", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: puntos.map((p) => [p.lon, p.lat]) },
            },
          });
          // Debajo de los nombres: una capa nueva va encima de todo, y con un
          // estilo vectorial eso significa tachar el texto del mapa.
          const primerTexto = (m2.getStyle()?.layers || []).find((c) => c.type === "symbol")?.id;
          m2.addLayer({
            id: "linea-ruta",
            type: "line",
            source: "ruta",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": TEAL, "line-width": 3, "line-opacity": 0.85 },
          }, primerTexto);
          // Flechas de sentido, para que se lea hacia donde va el viaje.
          m2.addLayer({
            id: "linea-flechas",
            type: "symbol",
            source: "ruta",
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 90,
              "text-field": "▶",
              "text-size": 11,
              "text-keep-upright": false,
              "text-allow-overlap": true,
            },
            paint: { "text-color": TEAL, "text-halo-color": "#fff", "text-halo-width": 1.4 },
          }, primerTexto);
        };

        /**
         * Los nombres del mapa, en el idioma del usuario.
         *
         * El estilo liberty rotula con `name` (el nombre LOCAL: "Deutschland",
         * "Ελλάδα") o con `name_en`. OpenMapTiles sirve ademas name:es,
         * name:en, name:pt y name:fr, asi que basta con reescribir el
         * text-field de las capas de simbolo pidiendo primero el idioma del
         * usuario y cayendo al latino y al local si ese pais no lo tiene.
         *
         * Se tocan solo las capas cuyo text-field ya menciona `name`: las
         * demas rotulan otra cosa (alturas, codigos) y reescribirlas las
         * dejaria en blanco.
         */
        function traducirNombres(m2, idioma) {
          const campo = [
            "coalesce",
            ["get", `name:${idioma}`],
            ["get", "name:latin"],
            ["get", "name"],
          ];
          for (const capa of m2.getStyle()?.layers || []) {
            if (capa.type !== "symbol") continue;
            const actual = capa.layout?.["text-field"];
            if (!actual || !JSON.stringify(actual).includes("name")) continue;
            try { m2.setLayoutProperty(capa.id, "text-field", campo); } catch {}
          }
        }

        /**
         * El mar con profundidad, no un azul plano.
         *
         * El estilo pinta el agua de un solo color liso encima del relieve de
         * Natural Earth, que SI trae batimetria: los oceanos vienen sombreados
         * y esa informacion quedaba tapada. Bajando la opacidad del agua a
         * zoom lejano, el relieve asoma por debajo y aparecen solos los tonos
         * oscuros de las fosas y los claros de la plataforma costera.
         *
         * Al acercarse el agua vuelve a ser opaca: ahi ya no hay batimetria
         * que ensenar y lo que interesa es que un rio o un puerto se lea
         * limpio.
         */
        // ---- QUE SE VEA COMO UN MAPA DE VERDAD -----------------------------
        //
        // El estilo traia colores de lamina escolar: mar azul primario y
        // campo verde manzana. En vez de elegir a ojo se bajaron tiles de
        // mapas reales y se contaron sus pixeles uno a uno:
        //
        //                                 hex      H     S     L    del tile
        //   MAR   lo que habia (z8)     #4a90d9   211   65%   57%
        //         OpenStreetMap         #aad3df   194   45%   77%     64%
        //         CARTO Voyager         #d5e8eb   188   35%   88%     64%
        //   VERDE lo que habia (bosque) #c2e39a    87   57%   75%
        //         OpenStreetMap         #e4ecd4    80   39%   88%
        //         OSM Carto (forest)    #add19e   102   36%   72%
        //   TIERRA el fondo de Liberty  #f8f4f0    30   36%   96%
        //         OpenStreetMap         #f2efe9    40   26%   93%   <- ya era real
        //
        // El patron es uno solo y se repite en las dos familias: los mapas
        // reales no usan colores mas claros ni mas oscuros, usan colores
        // MENOS SATURADOS. El mar estaba 20-25 puntos de saturacion por
        // encima de cualquier mapa serio y ademas 15 grados corrido hacia el
        // violeta; el verde, 20 puntos por encima.
        //
        // Y lo didactico no se pierde por bajar la saturacion —se pierde por
        // bajar el CONTRASTE—. Ese se mantiene con el degradado de
        // profundidad (mar hondo oscuro, plataforma clara) y con la tierra
        // color crema, que es exactamente lo que separa costa de agua en un
        // atlas de papel.
        function paletaReal(m2) {
          try {
            if (m2.getLayer("water")) {
              // EL COLOR SUBE DE TONO AL ACERCARSE.
              //
              // Un solo azul no sirve para las dos cosas: el oceano visto
              // desde el mundo pide un azul hondo, y el mismo azul en el
              // Manzanares deja un rio casi negro. Se interpola.
              m2.setPaintProperty("water", "fill-color", [
                "interpolate", ["linear"], ["zoom"],
                0, "#3f6f8c",   // oceano abierto   H 202  S 38%
                5, "#7ba8bf",   //                  H 196  S 35%
                8, "#a8cddb",   // plataforma       H 196  S 42%  (el de OSM)
                12, "#c3dee7",  // rios y lagos     H 194  S 43%
              ]);
              // La opacidad decide CUANTA batimetria se ve. Medido sobre el
              // tile real de Natural Earth (z2/1/1, 830 pixeles de oceano),
              // donde el relieve tiene 73 puntos de rango de luminancia:
              //
              //   opacidad   rango final   fosa (luminancia)
              //     0.55         33            168     <- palido, el original
              //     0.45         44            135     <- el elegido
              //     0.35         52            144
              //
              // Subir la opacidad NO oscurece el mar: lo APLANA. El agua es
              // un color liso, asi que cuanto mas tapa, menos batimetria
              // llega. El instinto de "mas azul encima para que se vea menos
              // palido" va justo al reves.
              //
              // 0.45 y no 0.35: se probaron los dos en pantalla. El 0.35 gana
              // 8 puntos de rango pero aclara la parte honda, y a ojo pesa
              // mas que el oceano abierto se vea PROFUNDO que exprimir el
              // ultimo contraste con la plataforma. Si algun dia se quiere lo
              // contrario, el numero esta aqui y la tabla dice que esperar.
              m2.setPaintProperty("water", "fill-opacity", [
                "interpolate", ["linear"], ["zoom"],
                0, 0.45,
                6, 0.75,
                9, 1,
              ]);
            }
            if (m2.getLayer("natural_earth")) {
              m2.setPaintProperty("natural_earth", "raster-opacity", [
                "interpolate", ["exponential", 1.5], ["zoom"],
                0, 1, 6, 0.35, 9, 0,
              ]);
              // Un empujon al relieve para separar fosa de plataforma. Poco:
              // esta capa tambien pinta la TIERRA a zoom lejano, y pasado
              // ~0.3 los continentes se vuelven chillones.
              m2.setPaintProperty("natural_earth", "raster-contrast", 0.2);
              // La saturacion baja de 0,15 a 0,05: aquel +0,15 estaba ahi para que
              // la tierra no se apagara debajo de un mar muy azul. Con el mar real
              // ya no hace falta, y de paso los continentes dejan de verse
              // carteleados a zoom lejano.
              m2.setPaintProperty("natural_earth", "raster-saturation", 0.05);
            }

            // VERDE SOLO DONDE HAY VEGETACION, Y APAGADO.
            //
            // Liberty pinta el campo entero de verde manzana al 70%: por eso
            // el mapa se leia como una lamina de colegio. Los valores de
            // abajo son los medidos en OpenStreetMap, que reserva el verde
            // para bosque y parque de verdad y deja el resto en crema.
            const pintar = (id, prop, val) => {
              try { if (m2.getLayer(id)) m2.setPaintProperty(id, prop, val); } catch {}
            };
            pintar("landcover_wood", "fill-color", "rgba(173,209,158,0.55)");
            pintar("landcover_grass", "fill-color", "rgba(198,219,182,0.9)");
            pintar("park", "fill-color", "#dde9d2");
            pintar("landcover_sand", "fill-color", "#f3ecd6");
            // Los rios en linea llevaban el azul violeta de fabrica y no
            // pegaban con el mar nuevo.
            for (const id of ["waterway_river", "waterway_other", "waterway_tunnel"]) {
              pintar(id, "line-color", "#a9ccdb");
            }
          } catch {}
        }

        function ajustar(m2) {
          try { m2.setProjection({ type: "mercator" }); } catch {}
          try { m2.getContainer().dataset.proyeccion = m2.getProjection()?.type || "?"; } catch {}
          const poner = (id, prop, val) => {
            try { if (m2.getLayer(id)) m2.setLayoutProperty(id, prop, val); } catch {};
          };
          const zoomDesde = (id, min) => {
            try { if (m2.getLayer(id)) m2.setLayerZoomRange(id, min, 24); } catch {};
          };
          // Aeropuertos y lugares antes de tener que buscarlos.
          zoomDesde("airport", 5);
          zoomDesde("poi_r1", 12);
          zoomDesde("aeroway_fill", 9);
          zoomDesde("aeroway_runway", 9);
          try {
            if (m2.getLayer("airport")) {
              m2.setPaintProperty("airport", "text-color", "#b8452a");
              m2.setPaintProperty("airport", "text-halo-color", "#ffffff");
              m2.setPaintProperty("airport", "text-halo-width", 1.6);
            }
          } catch {}
          // Escudos de carretera fuera: recuadros con "M-40" tapando barrios.
          // Los NOMBRES de calle se quedan.
          for (const id of ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]) {
            poner(id, "visibility", "none");
          }
          traducirNombres(m2, lang);
          paletaReal(m2);
          // El contenedor publica lo que quedo aplicado DE VERDAD, leido de
          // vuelta del mapa. Mismo motivo que data-proyeccion: sin esto, la
          // unica forma de saber si el idioma y el mar se aplicaron es mirar
          // el mapa pintado, y hay entornos donde no se puede.
          try {
            const d = m2.getContainer().dataset;
            d.idioma = lang;
            d.capasTraducidas = String(
              (m2.getStyle()?.layers || []).filter(
                (c) => c.type === "symbol" &&
                  JSON.stringify(c.layout?.["text-field"] || "").includes(`name:${lang}`)
              ).length
            );
            d.agua = String(m2.getPaintProperty("water", "fill-color") ?? "?");
            d.verde = String(m2.getPaintProperty("landcover_wood", "fill-color") ?? "?");
          } catch {}
          try { lineaRef.current?.(); } catch {}
        }

        // Dos caminos al mismo sitio: el evento canonico y un sondeo corto.
        // isStyleLoaded() se queda en false para siempre en algunos entornos, y
        // todo lo que colgaba solo de el se perdia sin avisar.
        mapa.once("style.load", () => { if (!cancelado) ajustar(mapa); });
        let intentos = 0;
        const sondeo = () => {
          if (cancelado || !mapaRef.current) return;
          if (mapaRef.current.isStyleLoaded()) { ajustar(mapaRef.current); return; }
          if (intentos++ < 50) setTimeout(sondeo, 120);
        };
        sondeo();
      } catch {
        if (!cancelado) setFallo(true);
      }
    }

    dibujar();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, lang]);

  // Lista -> mapa: volar a la parada elegida y abrir su ficha.
  useEffect(() => {
    if (!seleccionada || !mapaRef.current) return;
    const m = marcadoresRef.current.find((x) => x._anduve?.n === seleccionada);
    if (!m) return;
    mapaRef.current.flyTo({ center: [m._anduve.lon, m._anduve.lat], zoom: 7, duration: 700 });
    m._anduve.abrir();
  }, [seleccionada]);

  useEffect(
    () => () => {
      marcadoresRef.current.forEach((m) => m.remove());
      marcadoresRef.current = [];
      popupRef.current?.remove();
      mapaRef.current?.remove();
      mapaRef.current = null;
    },
    []
  );

  if (lista.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={ref}
        // Mas alto que antes (300): con once paradas europeas no cabia nada.
        // En movil se queda en 300, que es lo que deja ver el mapa sin comerse
        // la pantalla entera.
        className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
        style={{ height: alto, backgroundColor: FONDO }}
      />

      {puntos.length > 1 && (
        <button
          type="button"
          onClick={() => encuadrarRef.current?.(600)}
          className="absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-1.5 text-[12.5px] font-bold text-marca-800 shadow-md ring-1 ring-slate-200 backdrop-blur transition hover:bg-white dark:bg-slate-800/95 dark:text-marca-200 dark:ring-slate-600"
        >
          {t("mapaVerTodo")}
        </button>
      )}

      {/* LO QUE NO SE PUDO UBICAR SE DICE.
          Antes estas paradas desaparecian del mapa y no habia forma de saber
          que faltaban: un viaje de once paradas dibujaba diez. */}
      {sinUbicar.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[12.5px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <b>{t("mapaSinUbicar")}</b>{" "}
          {sinUbicar.map((p) => `${p.n}. ${p.ciudad}${p.iata ? ` (${p.iata})` : ""}`).join(" · ")}
        </div>
      )}

      {fallo && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {textoFallo}
        </div>
      )}
    </div>
  );
}
