// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // If you ever need email too:
      // authorization: { params: { scope: "identify email" } },
      profile(profile) {
        // Normalize Discord profile into NextAuth's User shape
        return {
          id: profile.id, // Discord user ID
          name: (profile as any).global_name ?? profile.username,
          email: null,
          image: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : undefined,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile, trigger, session }) {
      // On initial Discord sign-in, store the Discord user ID
      if (account?.provider === "discord") {
        token.discordId = account.providerAccountId; // numeric string
      }

      // Nice display name fallback from Discord profile
      if (profile && (profile as any).global_name) token.discordDisplay = (profile as any).global_name;
      else if (profile && (profile as any).username) token.discordDisplay = (profile as any).username;

      // If we later call `update()` on the session with an ncxid, persist it to the token
      if (trigger === "update" && session?.user?.ncxid) {
        token.ncxid = session.user.ncxid as string;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // Expose Discord ID on the session
        (session.user as any).discordId = token.discordId as string | undefined;
        // Also mirror onto `id` if you prefer to read `session.user.id`
        (session.user as any).id = token.discordId as string | undefined;

        // If we've persisted ncxid into the token, surface it on the session
        if (token.ncxid) (session.user as any).ncxid = token.ncxid as string;

        // Fill display name from token if missing
        if (!session.user.name && token.discordDisplay) {
          session.user.name = token.discordDisplay as string;
        }
      }
      return session;
    },
  },

  // If NextAuth warns about missing secret, uncomment and set in .env.local:
  // secret: process.env.NEXTAUTH_SECRET,
};
