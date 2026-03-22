"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setupDeeplinkHandler, isCapacitor, registerForPushNotifications } from "@/lib/capacitor";
import { triggerSessionRefresh } from "@/lib/useIOSSession";
import { useSession } from "next-auth/react";
import { Browser } from "@capacitor/browser";

/**
 * Set up auth deeplink handler for iOS OAuth callbacks
 */
export function AuthSetup() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitor()) return;

    // Register for push notifications on app launch
    registerForPushNotifications();

    // Listen for push notification taps
    (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: any) => {
          const url = notification?.notification?.data?.url || '/m/current';
          console.log('Push notification tapped, navigating to:', url);
          router.push(url);
        }
      );
    })();

    setupDeeplinkHandler(async (url) => {
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
          console.log("Auth successful, userId:", userId);

          // Call ios-verify endpoint to create session
          // The WebView makes this request, so the Set-Cookie response
          // will be stored in the WebView's cookie jar (not Safari's)
          const verifyResponse = await fetch("/api/auth/ios-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              userName,
            }),
          });

          if (!verifyResponse.ok) {
            throw new Error("Failed to verify session");
          }

          console.log("Session created successfully");

          // Fetch the iOS session (custom endpoint for iOS auth)
          const sessionResponse = await fetch("/api/auth/ios-session");
          const session = await sessionResponse.json();
          console.log("iOS Session check:", session);

          if (session?.user) {
            console.log("User logged in:", session.user.name);
            // Trigger session refresh in the hook
            console.log("Triggering session refresh...");
            triggerSessionRefresh();
            // Also refresh NextAuth session to sync UI
            console.log("Updating NextAuth session...");
            await updateSession();
            console.log("Session update complete");
            // Close Safari immediately
            try {
              console.log("Attempting to close browser...");
              await Browser.close();
              console.log("Safari closed successfully");
            } catch (err) {
              console.error("Failed to close browser:", err);
            }
            // Refresh page to show updated session
            setTimeout(() => {
              console.log("Refreshing page to show new session...");
              window.location.reload();
            }, 500);
          } else {
            console.error("No user data in session response");
          }
        } catch (err) {
          console.error("Auth setup error:", err);
          alert("Failed to create session: " + (err instanceof Error ? err.message : "Unknown error"));
        }
      }
    });
  }, [updateSession]);

  return null;
}
