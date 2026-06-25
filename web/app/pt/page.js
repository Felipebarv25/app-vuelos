// /pt — landing em português. Redireciona para a home com lang=pt.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Anduve · Planeje sua viagem perfeita",
  description:
    "Quanto você tem para gastar? Dizemos para onde ir, quando é mais barato e montamos seu plano dia a dia. Preços de voos ao vivo e recomendações personalizadas.",
  alternates: {
    canonical: "https://anduve-app.vercel.app/pt",
    languages: {
      es: "https://anduve-app.vercel.app/",
      en: "https://anduve-app.vercel.app/en",
      pt: "https://anduve-app.vercel.app/pt",
      fr: "https://anduve-app.vercel.app/fr",
      "x-default": "https://anduve-app.vercel.app/",
    },
  },
};

export default function HomePt() {
  redirect("/?lang=pt");
}
