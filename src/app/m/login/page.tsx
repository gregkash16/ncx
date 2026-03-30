"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { initiateAppleSignIn } from "@/lib/ios-apple-signin";

/**
 * iOS-only login page offering Sign in with Apple and Discord
 * Satisfies App Store Guideline 4.8 (alternative login service)
 *
 * Sign in with Apple is handled natively via iOS app (NCXAppleSignInPlugin.swift)
 * and communicates via window.signInWithAppleComplete() callback
 */
export default function LoginPage() {
  const [loading, setLoading] = useState<"discord" | null>(null);

  // Register global callbacks on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Already declared in ios-apple-signin.ts, but ensure they're in scope
      console.log("Login page loaded - Apple Sign In ready");
    }
  }, []);

  const handleAppleSignIn = () => {
    console.log("Apple Sign In button tapped");
    initiateAppleSignIn();
  };

  const handleDiscordLogin = () => {
    setLoading("discord");
    signIn("discord", { callbackUrl: "/m" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--ncx-bg)] px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--ncx-text-primary)]">
            NCX
          </h1>
          <p className="text-sm text-[var(--ncx-text-muted)] mt-2">
            Star Wars X-Wing Draft League
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          {/* Sign in with Apple (handled by native iOS) */}
          <button
            id="apple-signin-button"
            onClick={handleAppleSignIn}
            className="w-full px-4 py-3 rounded-lg bg-black hover:bg-gray-900 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.51.93.64 1.54 1.74 1.54 2.99 0 .35-.03.7-.1 1.02.72 0 1.97-.12 2.05-.13.01-.03.02-.08.02-.13 0-1.9-1.54-3.46-3.46-3.46zm-5.5 0c-1.92 0-3.46 1.56-3.46 3.46 0 .05 0 .1.02.13.08.01 1.33.13 2.05.13-.07-.32-.1-.67-.1-1.02 0-1.25.61-2.35 1.54-2.99-.43-.96-1.34-1.51-2.25-1.51zm5.5-1.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-5.5 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z" />
            </svg>
            Sign in with Apple
          </button>

          {/* Sign in with Discord */}
          <button
            onClick={handleDiscordLogin}
            disabled={loading !== null}
            className="w-full px-4 py-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading === "discord" ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Signing in...
              </>
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.05 13.5c-.91 0-1.82.55-2.25 1.51.93.64 1.54 1.74 1.54 2.99 0 .35-.03.7-.1 1.02.72 0 1.97-.12 2.05-.13.01-.03.02-.08.02-.13 0-1.9-1.54-3.46-3.46-3.46zm-5.5 0c-1.92 0-3.46 1.56-3.46 3.46 0 .05 0 .1.02.13.08.01 1.33.13 2.05.13-.07-.32-.1-.67-.1-1.02 0-1.25.61-2.35 1.54-2.99-.43-.96-1.34-1.51-2.25-1.51zm5.5-1.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-5.5 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z" />
                </svg>
                Sign in with Discord
              </>
            )}
          </button>
        </div>

        {/* Help text */}
        <p className="text-xs text-[var(--ncx-text-muted)] text-center">
          Choose a login method to get started. Demo accounts have full access
          to report games and manage matches.
        </p>
      </div>
    </div>
  );
}
