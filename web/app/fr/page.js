// /fr — landing en français. Redirige vers l'accueil avec lang=fr.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Viajero 360 · Planifiez votre voyage parfait",
  description:
    "Combien pouvez-vous dépenser ? Nous vous disons où aller, quand c'est moins cher et planifions chaque jour. Prix de vols en direct et recommandations personnalisées.",
  alternates: {
    canonical: "https://app-vuelos-mfos.vercel.app/fr",
    languages: {
      es: "https://app-vuelos-mfos.vercel.app/",
      en: "https://app-vuelos-mfos.vercel.app/en",
      pt: "https://app-vuelos-mfos.vercel.app/pt",
      fr: "https://app-vuelos-mfos.vercel.app/fr",
      "x-default": "https://app-vuelos-mfos.vercel.app/",
    },
  },
};

export default function HomeFr() {
  redirect("/?lang=fr");
}
