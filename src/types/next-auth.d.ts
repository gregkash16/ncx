import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordId?: string; // ← we add this
      id?: string;        // ← add if you chose Option B
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    discordDisplay?: string;
  }
}

