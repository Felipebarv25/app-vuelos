// Alto real de cada bandera de flagcdn, para poder reservar su sitio exacto.
//
// POR QUE HACE FALTA UNA TABLA
//
// <Bandera> asumia 4:3 para todas. No lo es casi ninguna: de los 242
// paises que esta app puede pintar, 109 son 40x27 y 73 son 40x20. Al
// declarar un alto que no era el real, el navegador reservaba un sitio y
// repintaba en otro: 5,8 px de salto medidos en Mexico, con 207 banderas
// en /destino.
//
// El apano de fijar la caja a 4:3 con `object-fit: contain` quitaba el salto
// pero encogia las mas altas: Suiza, que es CUADRADA, salia visiblemente mas
// angosta que sus vecinas. Con el alto de verdad no hay que elegir — todas
// van al mismo ancho, cada una con su propio alto, y no se mueve nada.
//
// GENERADA, NO ESCRITA A MANO. Los valores salen de leer la cabecera IHDR de
// cada PNG de https://flagcdn.com/w40/<cc>.png. Si flagcdn cambia una
// proporcion se vuelve a generar; no se corrige a ojo.
//
// Se agrupa por alto (y no cc -> alto) porque asi son 16 entradas en vez de
// 242, y de un vistazo se ve que casi todas son 3:2.
//
// Nota: "ks" no lo sirve flagcdn (Kosovo es "xk"). Cae al defecto y, si la
// imagen falla, el onError de <Bandera> la esconde.

const DEFECTO = 27;

const POR_ALTO = {
  20:
    "ae ai am as au az ba bm bn bs by ca cc ck cu cx dm eh er et fj fk " +
    "gb gi gw hn hr hu ie im io jm jo ki kp kw ky kz lc lk lv ly md me " +
    "mk mn mp ms my nc nf ng nr nu nz ph ps sb sc sd sh si ss st tc tj " +
    "tl to tv uz vg ws zw",
  24:
    "bd bg bh bi bz cr cv de fi gd gy ht je kg km li lt lu ni tt vu",
  25:
    "ar ee gt pl pw se tg",
  29:
    "al fo il is no xk",
  21:
    "fm gu lr mh um us",
  30:
    "cd dk ga pg sm",
  23:
    "ir mx om sv",
  28:
    "ad br",
  40:
    "ch va",
  35:
    "be",
  26:
    "kh",
  32:
    "mc",
  34:
    "ne",
  49:
    "np",
  22:
    "py",
  16:
    "qa",
};

const ALTO_W40 = (() => {
  const m = new Map();
  for (const [alto, lista] of Object.entries(POR_ALTO)) {
    for (const cc of lista.split(" ").filter(Boolean)) m.set(cc, Number(alto));
  }
  return m;
})();

/** Alto en px que ocupa la bandera `cc` cuando se pide con ancho `ancho`. */
export function altoDeBandera(cc, ancho) {
  const h = ALTO_W40.get(String(cc || "").toLowerCase()) || DEFECTO;
  return Math.round((ancho * h) / 40);
}
