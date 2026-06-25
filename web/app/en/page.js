// /en — English landing. For now redirects to the main home (which is client-
// rendered with i18n via the Bienvenida selector). When EN traffic justifies
// the work, we can build a fully translated EN home with hreflang.
//
// The redirect uses 307 (temporary) so search engines don't permanently
// consolidate signal to the ES home — when we have a real EN home, they'll
// transparently follow it.
import { redirect } from "next/navigation";

export const metadata = {
  title: "Anduve · Plan your perfect trip from anywhere",
  description:
    "How much do you have to spend? We tell you where to go, when it's cheaper, and build your day-by-day plan. Live flight prices and tailored recommendations.",
  alternates: {
    canonical: "https://anduve-app.vercel.app/en",
    languages: {
      es: "https://anduve-app.vercel.app/",
      en: "https://anduve-app.vercel.app/en",
      "x-default": "https://anduve-app.vercel.app/",
    },
  },
};

export default function HomeEn() {
  redirect("/?lang=en");
}
