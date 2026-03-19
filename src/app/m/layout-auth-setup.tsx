"use client";

import { useEffect } from "react";
import { setupDeeplinkHandler, isCapacitor } from "@/lib/capacitor";
import { useSession } from "next-auth/react";

/**
 * Set up auth deeplink handler for iOS OAuth callbacks
 */
export function AuthSetup() {
  const { data: session, update: updateSession } = useSession();

  useEffect(() => {
    if (!isCapacitor()) return;

    setupDeeplinkHandler((url) => {
      console.log("Received deeplink:", url);

      const urlObj = new URL(url);
      const success = urlObj.searchParams.get("success");
      const error = urlObj.searchParams.get("error");
      const userId = urlObj.searchParams.get("userId");
      const userName = urlObj.searchParams.get("userName");

      // Also try parsing JSON user data for backwards compatibility
      const userData = urlObj.searchParams.get("user");

      if (error) {
        console.error("Auth error:", error);
        alert("Login failed: " + error);
        return;
      }

      if (success && (userId || userData)) {
        try {
          console.log("Auth successful");

          // Refresh the session from NextAuth
          // This will trigger a re-fetch of /api/auth/session which should pick up the new auth
          setTimeout(() => {
            updateSession();
          }, 500);
        } catch (err) {
          console.error("Auth setup error:", err);
        }
      }
    });
  }, [updateSession]);

  return null;
}
