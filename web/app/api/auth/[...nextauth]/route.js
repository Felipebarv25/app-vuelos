// NextAuth con Google. Estrategia JWT (sin DB): la sesión vive en una cookie
// firmada con NEXTAUTH_SECRET. Para un login simple sin "Mis viajes" en la
// nube es suficiente. Si después queremos sincronizar entre dispositivos,
// añadimos un adapter (Vercel KV / Supabase) sin tocar este archivo.
//
// Env vars necesarias en Vercel (Settings → Environment Variables):
//   · NEXTAUTH_URL = https://app-vuelos-mfos.vercel.app
//   · NEXTAUTH_SECRET = (cualquier string aleatorio largo)
//   · GOOGLE_CLIENT_ID = (desde Google Cloud Console)
//   · GOOGLE_CLIENT_SECRET = (desde Google Cloud Console)
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  // Para que el JWT incluya el id del usuario y la foto (útil para el frontend).
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || token.sub || null;
        if (token.picture) session.user.image = token.picture;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
