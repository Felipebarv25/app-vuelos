"use client";
// Botón corazón en la esquina del hero de /destino/<slug>. Marca/desmarca el
// destino como favorito; sincroniza con nube si hay Google login.
import { useApp } from "@/lib/AppContext";
import { useFavoritos } from "@/lib/favoritos";
import BotonFav from "@/components/BotonFav";

export default function FavToggle({ slug, conFoto = false }) {
  const { usuario } = useApp();
  const { esFav, toggle, listo } = useFavoritos(usuario);

  if (!listo) return null;

  return (
    <div className={conFoto ? "absolute right-4 top-4 z-10" : "ml-auto"}>
      <BotonFav activo={esFav(slug)} onClick={() => toggle(slug)} etiqueta="Guardar destino" />
    </div>
  );
}
