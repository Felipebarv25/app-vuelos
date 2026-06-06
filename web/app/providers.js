"use client";
// Providers cliente: NextAuth (sesión) y nuestro AppProvider (idioma, usuario,
// preferencias). Se mantiene en un solo lugar para que layout.js siga siendo
// un Server Component (importante para SEO).
import { SessionProvider } from "next-auth/react";
import { AppProvider } from "@/lib/AppContext";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <AppProvider>{children}</AppProvider>
    </SessionProvider>
  );
}
