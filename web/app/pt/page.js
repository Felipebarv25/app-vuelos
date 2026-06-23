// /pt — landing em português. Redireciona para a home com lang=pt.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Anduve · Planeje sua viagem perfeita",
  description:
    "Quanto você tem para gastar? Dizemos para onde ir, quando é mais barato e montamos seu plano dia a dia. Preços de voos ao vivo e recomendações personalizadas.",
  alternates: {
    canonical: "https://app-vuelos-mfos.vercel.app/pt",
    languages: {
      es: "https://app-vuelos-mfos.vercel.app/",
      en: "https://app-vuelos-mfos.vercel.app/en",
      pt: "https://app-vuelos-mfos.vercel.app/pt",
      fr: "https://app-vuelos-mfos.vercel.app/fr",
      "x-default": "https://app-vuelos-mfos.vercel.app/",
    },
  },
};

export default function HomePt() {
  redirect("/?lang=pt");
}
