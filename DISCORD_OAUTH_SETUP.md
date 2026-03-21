# Discord OAuth Setup for Capacitor iOS App

This guide walks through enabling Discord OAuth with Safari-based login on iOS.

## Step 1: Add Custom URL Scheme to Xcode Project

This allows the app to handle deeplinks like `ncxapp://auth-callback`.

1. **Open the iOS project in Xcode**:
   ```bash
   NODE_ENV=development npx cap open ios
   ```

2. **Select the App project** in the left sidebar

3. **Select the "App" target** under TARGETS

4. **Go to the "Info" tab** at the top

5. **Scroll down to "URL Types"** (or search for it)

6. **Click the "+" button** to add a new URL Type

7. **Configure it**:
   - **Identifier**: `com.ncx.app` (or your app ID)
   - **URL Schemes**: `ncxapp`
   - **Role**: Editor

8. **Save and verify** it appears in your `Info.plist`

## Step 2: Update Discord App Settings

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)

2. Select your NCX application

3. Go to **OAuth2** in the left sidebar

4. Under **Redirect URLs**, add:
   ```
   ncxapp://auth-callback
   ```

5. Save the changes

## Step 3: Update Your App Code

When the user taps "Sign in with Discord", use the Capacitor function:

```typescript
import { startDiscordLogin } from '@/lib/capacitor';

const handleDiscordLogin = async () => {
  const result = await startDiscordLogin(
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ''
  );

  if (!result.success) {
    alert('Login failed: ' + result.error);
  }
  // If successful, wait for the deeplink callback
};
```

## Step 4: Handle Auth Callback in Your Component

Set up the deeplink handler in your auth component or layout:

```typescript
import { useEffect } from 'react';
import { setupDeeplinkHandler } from '@/lib/capacitor';

export default function AuthComponent() {
  useEffect(() => {
    setupDeeplinkHandler((deeplink) => {
      if (deeplink.includes('auth-callback')) {
        const url = new URL(deeplink);
        const success = url.searchParams.get('success');
        const error = url.searchParams.get('error');

        if (error) {
          alert('Auth failed: ' + error);
          return;
        }

        if (success) {
          // User successfully authenticated
          // Fetch the session from the server
          fetch('/api/auth/session')
            .then((res) => res.json())
            .then((session) => {
              if (session?.user) {
                // User is logged in!
                console.log('Logged in as:', session.user);
                // Redirect or update UI
              }
            });
        }
      }
    });
  }, []);

  return (
    <button onClick={handleDiscordLogin}>
      Sign in with Discord
    </button>
  );
}
```

## How It Works

1. User taps "Sign in with Discord"
2. `startDiscordLogin()` opens Discord OAuth in Safari (not in-app WebView)
3. User logs into Discord
4. Discord redirects to `ncxapp://auth-callback?success=true`
5. iOS app intercepts this deeplink
6. Your handler fetches the session and updates the UI

## Testing

1. Make sure `npm run dev` is running
2. Open the app in the iOS simulator
3. Tap the Discord login button
4. Safari should open with Discord's login page
5. After login, you should be redirected back to the app

## Troubleshooting

**Safari opens but nothing happens after login:**
- Check that the redirect URL in Discord Developer Portal matches `ncxapp://auth-callback`
- Verify the URL scheme was added correctly in Xcode's Info.plist
- Check console logs in Xcode for errors

**Deep link handler not firing:**
- Ensure `setupDeeplinkHandler` is called when the app loads
- Check Xcode console for `appUrlOpen` events

**Auth still uses in-app WebView:**
- Make sure you're using `startDiscordLogin()` instead of the default NextAuth flow
- Verify the code is running in Capacitor (use `isCapacitor()` to check)

## Production Build

When building for App Store:
1. Make sure the URL scheme is still configured in the build
2. Test on a real device before submitting
3. Verify redirect URLs are using HTTPS in production
