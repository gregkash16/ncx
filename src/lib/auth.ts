// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const isProd = process.env.NODE_ENV === "production";
// Only set a cookie domain in prod so localhost/dev still works
const cookieDomain = isProd ? ".nickelcityxwing.com" : undefined;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  // Only specify cookies when we actually need the cross-subdomain behavior in prod.
  cookies: cookieDomain
    ? {
        sessionToken: {
          name: "__Secure-next-auth.session-token",
          options: {
            domain: cookieDomain,
            path: "/",
            sameSite: "lax",
            secure: true,
            httpOnly: true,
          },
        },
        callbackUrl: {
          name: "__Secure-next-auth.callback-url",
          options: {
            domain: cookieDomain,
            path: "/",
            sameSite: "lax",
            secure: true,
          },
        },
        csrfToken: {
          name: "__Host-next-auth.csrf-token",
          options: {
            path: "/",
            sameSite: "lax",
            secure: true,
          },
        },
      }
    : undefined,

  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // If you ever need email add: authorization: { params: { scope: "identify email" } },
      profile(profile) {
        return {
          id: profile.id,
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
      if (account?.provider === "discord") {
        token.discordId = account.providerAccountId;
      }
      if (profile && (profile as any).global_name) {
        token.discordDisplay = (profile as any).global_name;
      } else if (profile && (profile as any).username) {
        token.discordDisplay = (profile as any).username;
      }
      if (trigger === "update" && session?.user?.ncxid) {
        token.ncxid = session.user.ncxid as string;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).discordId = token.discordId as string | undefined;
        (session.user as any).id = token.discordId as string | undefined;
        if (token.ncxid) (session.user as any).ncxid = token.ncxid as string;
        if (!session.user.name && token.discordDisplay) {
          session.user.name = token.discordDisplay as string;
        }
      }
      return session;
    },
  },

  // If NextAuth warns about secret, set:
  // NEXTAUTH_SECRET (v4) or AUTH_SECRET (v5)
};
