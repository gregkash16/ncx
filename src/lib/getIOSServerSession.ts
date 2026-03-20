import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { cookies } from "next/headers";

/**
 * Get session from either NextAuth or iOS custom session cookie
 * Used server-side to handle both web and iOS app authentication
 */
export async function getIOSServerSession() {
  // Try NextAuth first
  const nextAuthSession = await getServerSession(authOptions);
  if (nextAuthSession?.user) {
    return nextAuthSession;
  }

  // Fall back to iOS session cookie
  const cookieStore = await cookies();
  const iosSessionCookie = cookieStore.get("ios-session")?.value;

  if (!iosSessionCookie) {
    return null;
  }

  try {
    const userData = JSON.parse(iosSessionCookie);
    return {
      user: {
        id: userData.userId,
        discordId: userData.userId,
        name: userData.userName,
      },
    };
  } catch (err) {
    console.error("Failed to parse iOS session cookie:", err);
    return null;
  }
}
