"use client";
// Cuenta UNA visita a /pro por sesion de navegador.
//
// La pagina es un componente de servidor —tiene que serlo, es una landing
// indexable— asi que el evento se emite desde aqui. No manda nada del
// visitante: solo "alguien miro la pagina de Pro".
import { useEffect } from "react";
import { track } from "@/lib/track";

export default function ProVista() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("anduve_pro_view")) return;
      sessionStorage.setItem("anduve_pro_view", "1");
    } catch { /* sin sessionStorage se cuenta igual */ }
    track("pro_view", { desde: "pagina" });
  }, []);
  return null;
}
