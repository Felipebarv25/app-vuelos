"use client";
// Boton de checkout para la pagina /pro. Cliente porque (a) lee process.env
// NEXT_PUBLIC_LS_URL_* en runtime y (b) prefijea el email del usuario en el
// link de Lemon Squeezy para que despues podamos asociar la compra al perfil.
import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { track } from "@/lib/track";

export default function ProCheckoutBoton({ tipo, destacado = false }) {
  const { usuario, pro } = useApp();
  const [url, setUrl] = useState("");

  useEffect(() => {
    const env = {
      anual: process.env.NEXT_PUBLIC_LS_URL_ANUAL,
      mensual: process.env.NEXT_PUBLIC_LS_URL_MENSUAL,
      lifetime: process.env.NEXT_PUBLIC_LS_URL_LIFETIME,
    };
    let u = env[tipo] || "";
    if (u && usuario?.email) {
      const sep = u.includes("?") ? "&" : "?";
      u += `${sep}checkout%5Bemail%5D=${encodeURIComponent(usuario.email)}`;
    }
    setUrl(u);
  }, [tipo, usuario?.email]);

  function ir() {
    track("pro_checkout", { tipo });
    if (!url) {
      alert("El checkout aún no está configurado. Avísanos.");
      return;
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener");
    }
  }

  if (pro) {
    return (
      <div className="mt-5 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-[13px] font-bold text-emerald-700">
        ★ Ya eres Pro
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={ir}
      className={`mt-5 block w-full rounded-2xl py-3.5 text-[14.5px] font-bold transition ${
        destacado
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-marca hover:brightness-105"
          : "border-2 border-marca-200 bg-white text-marca-700 hover:bg-marca-50"
      }`}
    >
      Empezar →
    </button>
  );
}
