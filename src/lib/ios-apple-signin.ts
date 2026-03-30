/**
 * iOS App utilities for Sign in with Apple integration
 *
 * Flow:
 * 1. User taps "Sign in with Apple" button on /m/login page
 * 2. JavaScript calls initiateAppleSignIn()
 * 3. Native iOS shows ASAuthorizationController (native Apple UI)
 * 4. User authorizes with Face ID / Touch ID / Password
 * 5. Native code calls window.signInWithAppleComplete(name, email)
 * 6. JavaScript sends credentials to /api/auth/apple-callback
 * 7. Backend sets ios-apple-session cookie
 * 8. Redirect to /m
 */

export interface AppleSignInCredential {
  name: string;
  email: string;
}

/**
 * Initiate Sign in with Apple from the web view
 * Uses URL scheme to trigger AppDelegate
 */
export function initiateAppleSignIn() {
  try {
    console.log("Initiating Apple SignIn via URL scheme");
    // Navigate to custom URL scheme - AppDelegate will intercept it
    window.location.href = "applesignin://signin";
  } catch (error) {
    console.warn("Failed to initiate Apple SignIn:", error);
  }
}

/**
 * This is called FROM native iOS code after user completes Sign in with Apple
 * Do NOT call this directly - it's invoked by AppDelegate.swift
 */
export async function signInWithAppleComplete(credential: AppleSignInCredential) {
  try {
    const response = await fetch("/api/auth/apple-callback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-platform": "ios",
      },
      body: JSON.stringify({
        name: credential.name,
        email: credential.email,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sign in failed: ${response.statusText}`);
    }

    console.log("Apple sign in successful");

    // Redirect to home
    window.location.href = "/m";
  } catch (error) {
    console.error("Apple sign in error:", error);
    window.signInWithAppleError?.(
      error instanceof Error ? error.message : "Sign in failed"
    );
  }
}

/**
 * This is called FROM native iOS code if there's an error
 * Do NOT call this directly
 */
export function signInWithAppleError(message: string) {
  console.error("Apple sign in error from native:", message);
  alert(`Sign in with Apple failed: ${message}`);
}

// Make these globally accessible for native code to call
if (typeof window !== "undefined") {
  (window as any).signInWithAppleComplete = signInWithAppleComplete;
  (window as any).signInWithAppleError = signInWithAppleError;
}
