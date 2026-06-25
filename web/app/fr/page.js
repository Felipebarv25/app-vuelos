// /fr — landing en français. Redirige vers l'accueil avec lang=fr.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Anduve · Planifiez votre voyage parfait",
  description:
    "Combien pouvez-vous dépenser ? Nous vous disons où aller, quand c'est moins cher et planifions chaque jour. Prix de vols en direct et recommandations personnalisées.",
  alternates: {
    canonical: "https://anduve-app.vercel.app/fr",
    languages: {
      es: "https://anduve-app.vercel.app/",
      en: "https://anduve-app.vercel.app/en",
      pt: "https://anduve-app.vercel.app/pt",
      fr: "https://anduve-app.vercel.app/fr",
      "x-default": "https://anduve-app.vercel.app/",
    },
  },
};

export default function HomeFr() {
  redirect("/?lang=fr");
}
