// /en — English landing. For now redirects to the main home (which is client-
// rendered with i18n via the Bienvenida selector). When EN traffic justifies
// the work, we can build a fully translated EN home with hreflang.
//
// The redirect uses 307 (temporary) so search engines don't permanently
// consolidate signal to the ES home — when we have a real EN home, they'll
// transparently follow it.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Viajero 360 · Plan your perfect trip from anywhere",
  description:
    "How much do you have to spend? We tell you where to go, when it's cheaper, and build your day-by-day plan. Live flight prices and tailored recommendations.",
  alternates: {
    canonical: "https://app-vuelos-mfos.vercel.app/en",
    languages: {
      es: "https://app-vuelos-mfos.vercel.app/",
      en: "https://app-vuelos-mfos.vercel.app/en",
      "x-default": "https://app-vuelos-mfos.vercel.app/",
    },
  },
};

export default function HomeEn() {
  redirect("/?lang=en");
}
