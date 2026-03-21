# Capacitor iOS Implementation - Complete Documentation

**Last Updated:** March 19, 2026
**Status:** Discord OAuth with Safari working; Session persistence pending
**Branch:** `capacitor-ios`

---

## Table of Contents

1. [Overview](#overview)
2. [What's Completed](#whats-completed)
3. [Architecture](#architecture)
4. [Current Configuration](#current-configuration)
5. [How Discord OAuth Works](#how-discord-oauth-works)
6. [Development Setup](#development-setup)
7. [Known Issues & Solutions](#known-issues--solutions)
8. [Next Steps](#next-steps)
9. [Files Changed](#files-changed)
10. [Important URLs & Credentials](#important-urls--credentials)

---

## Overview

Converting the NCX mobile web app into a native iOS app using Capacitor. The app loads the `/m/` mobile pages from Next.js and provides native iOS features via Capacitor plugins.

**Key Challenge Solved:** Discord OAuth with Safari instead of in-app WebView (Apple security requirement).

---

## What's Completed

### ✅ Capacitor Setup
- Installed Capacitor CLI and core packages
- Added iOS platform with Xcode project
- Configured `capacitor.config.ts` to load app from `localhost:3000` in dev
- Generated proper Xcode project structure
- App builds and runs in iOS simulator

### ✅ Discord OAuth with Safari
- User can authenticate via Discord without WebView
- OAuth flow opens Discord login in Safari (not in-app browser)
- After authorization, user is redirected via deep link back to app
- Deep link handler receives user data:
  - Discord user ID: `349349801076195329`
  - Username: `gregkash`
  - Avatar URL
- Successfully tested with ngrok tunnel for redirect URI

### ✅ Deep Link Setup
- Registered URL scheme `com.ncx.app://` in Xcode Info.plist
- App intercepts incoming deep links via `App.addListener('appUrlOpen')`
- Deep link handler logs received data and parses auth response
- Callback URL format: `com.ncx.app://auth?success=true&userId=...&userName=...`

### ✅ Development Environment
- ngrok tunnel configured to expose localhost:3000 to Discord
- Discord Developer Portal updated with ngrok redirect URL
- Environment variables properly set in `.env.local`
- Hot reload working in the app

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ iOS App (Capacitor)                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  App.tsx (loads from http://localhost:3000/m)          │
│    ├── AuthStatus.tsx (Sign In button)                 │
│    │   └── startDiscordLogin() [in Capacitor mode]     │
│    │                                                   │
│    └── layout-auth-setup.tsx (Deep link handler)       │
│        └── setupDeeplinkHandler()                      │
│            └── Receives: com.ncx.app://auth?...        │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Safari (External OAuth)                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ User opens Discord login via Browser.open()            │
│ Discord: https://discord.com/api/oauth2/authorize      │
│   ├── client_id: 1482998745854509117                   │
│   ├── redirect_uri: https://d965e26a3d7b.ngrok.app/... │
│   └── scope: identify                                  │
│                                                         │
│ After auth, Discord redirects to:                      │
│ https://d965e26a3d7b.ngrok.app/api/auth/ios-callback   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Next.js Backend (localhost:3000)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ /api/auth/ios-callback (GET)                           │
│  └── Receives code from Discord                        │
│      ├── Exchange code for access token (Discord API)  │
│      ├── Fetch user info (Discord API)                 │
│      └── Redirect to: com.ncx.app://auth?...           │
│                                                         │
│ /api/auth/session (GET)                                │
│  └── Returns current session (NextAuth)                │
│      [ISSUE: Doesn't recognize iOS auth yet]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ App Deep Link Handler                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Receives: com.ncx.app://auth?userId=...&userName=...   │
│  └── Parse user data                                   │
│      └── Call updateSession() [PENDING]                │
│          └── [Should create/update NextAuth session]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Current Configuration

### Environment Variables (.env.local)

```
# Discord OAuth
DISCORD_CLIENT_ID=1482998745854509117
DISCORD_CLIENT_SECRET=nwEaD-NepRHV406itzHm6Nt8x9pCIMaD
NEXT_PUBLIC_DISCORD_CLIENT_ID=1482998745854509117

# NextAuth
NEXTAUTH_SECRET=somerandomkeygeneratedwithopenssl
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_URL_INTERNAL=http://localhost:3000
AUTH_TRUST_HOST=true

# Database & other vars...
# [See .env.local for full list]
```

### Xcode Configuration

**URL Scheme Setup:**
- Target: App
- Tab: Info
- URL Types section:
  - Identifier: `com.ncx.app`
  - URL Schemes: `com.ncx.app`
  - Role: Editor

### Discord Developer Portal

**Application:** NCX iPhone App (ID: 1482998745854509117)

**OAuth2 Settings:**
- Client ID: `1482998745854509117`
- Client Secret: `nwEaD-NepRHV406itzHm6Nt8x9pCIMaD`
- Redirect URL: `https://d965e26a3d7b.ngrok.app/api/auth/ios-callback`
  - ⚠️ **IMPORTANT:** This is the ngrok tunnel URL for development only
  - For production: Update to `https://nickelcityxwing.com/api/auth/ios-callback`

### Capacitor Config (capacitor.config.ts)

```typescript
const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.ncx.app',
  appName: 'NCX',
  webDir: isDev ? 'public' : '.next/standalone/public',
  server: isDev
    ? {
        url: 'http://localhost:3000',
        cleartext: true,
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};
```

---

## How Discord OAuth Works (Current Flow)

### Step 1: User Taps "Sign In"
**File:** `src/app/m/components/AuthStatus.tsx`

```typescript
const handleSignIn = async () => {
  if (isCapacitor()) {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
    await startDiscordLogin(clientId);  // ← Custom function for Safari
  } else {
    signIn("discord", { callbackUrl: "/m" });  // ← Standard NextAuth
  }
};
```

### Step 2: Open Discord in Safari
**File:** `src/lib/capacitor.ts` → `startDiscordLogin()`

```typescript
const redirectUri = 'https://d965e26a3d7b.ngrok.app/api/auth/ios-callback';
const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
discordAuthUrl.searchParams.set('client_id', clientId);
discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
discordAuthUrl.searchParams.set('response_type', 'code');
discordAuthUrl.searchParams.set('scope', 'identify');
discordAuthUrl.searchParams.set('state', randomState);

await Browser.open({ url: discordAuthUrl.toString() });
```

**Browser.open()** is from `@capacitor/browser` plugin - opens URL in Safari, not WebView.

### Step 3: User Authenticates with Discord
- Safari displays Discord login page
- User logs in with Discord credentials
- User grants permission to app to access username/avatar
- Discord redirects to: `https://d965e26a3d7b.ngrok.app/api/auth/ios-callback?code=...&state=...`

### Step 4: Backend Handles OAuth Callback
**File:** `src/app/api/auth/ios-callback/route.ts`

```typescript
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  // 1. Exchange code for Discord access token
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://d965e26a3d7b.ngrok.app/api/auth/ios-callback',
    }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // 2. Get user info from Discord
  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const user = await userResponse.json();
  // user = { id, username, global_name, avatar, ... }

  // 3. Redirect back to app with user data
  return NextResponse.redirect(
    `com.ncx.app://auth?success=true&userId=${user.id}&userName=${user.global_name}`
  );
}
```

### Step 5: App Receives Deep Link
**File:** `src/app/m/layout-auth-setup.tsx`

```typescript
setupDeeplinkHandler((url) => {
  // url = "com.ncx.app://auth?success=true&userId=349349801076195329&userName=gregkash"

  const urlObj = new URL(url);
  const success = urlObj.searchParams.get("success");
  const userId = urlObj.searchParams.get("userId");
  const userName = urlObj.searchParams.get("userName");

  if (success && userId) {
    console.log("User authenticated:", userName);
    updateSession(); // ← [PENDING: Should create NextAuth session]
  }
});
```

---

## Development Setup

### Prerequisites
- macOS
- Xcode 14+
- Node.js 18+
- npm

### Initial Setup (First Time)

```bash
# 1. Clone and switch to branch
cd /Users/gregkash/Documents/GitHub/ncx
git checkout capacitor-ios

# 2. Install dependencies (already done, but for reference)
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm install @capacitor/push-notifications @capacitor/browser @capacitor/app

# 3. Set up environment file
# Copy .env.local with correct Discord credentials
# File should be named `.env.local` (hidden file on macOS)
# Key vars needed:
#   DISCORD_CLIENT_ID=1482998745854509117
#   DISCORD_CLIENT_SECRET=nwEaD-NepRHV406itzHm6Nt8x9pCIMaD
#   NEXT_PUBLIC_DISCORD_CLIENT_ID=1482998745854509117
#   MYSQLPASSWORD=mChKvvEQzxWOKOBhPcYHltMyADqwhpWz
```

### Running in Development

**Terminal 1: Start ngrok tunnel**
```bash
ngrok http 3000
# Output: Forwarding https://d965e26a3d7b.ngrok.app -> http://localhost:3000
# Copy the URL for next step
```

**Terminal 2: Start Next.js dev server**
```bash
cd /Users/gregkash/Documents/GitHub/ncx
npm run dev
# Output: ⚡ Ready on http://localhost:3000
```

**Terminal 3: Sync and open Xcode**
```bash
cd /Users/gregkash/Documents/GitHub/ncx
NODE_ENV=development npx cap sync ios
NODE_ENV=development npx cap open ios
```

**In Xcode:**
- Select iPhone simulator from top dropdown
- Click Play button (▶)
- Wait for app to load

### Testing Discord OAuth

1. App loads at `http://localhost:3000/m`
2. Tap "Sign in" button
3. Safari opens with Discord login
4. Log in with Discord (use account: gregkash / password: [your password])
5. Grant permission
6. App receives deep link and logs "Auth successful"
7. ⚠️ **CURRENT ISSUE:** Sign In button still shows (session not created)

---

## Known Issues & Solutions

### Issue 1: "State cookie was missing" (SOLVED)
**Problem:** NextAuth's OAuth callback requires cookies, but Safari doesn't share cookies with the WebView.

**Solution:** Created custom `/api/auth/ios-callback` endpoint that handles OAuth flow manually without relying on cookies.

---

### Issue 2: Session Not Persisting (CURRENT)
**Problem:** User authenticates successfully and we receive their data via deep link, but `updateSession()` doesn't create a proper NextAuth session. The `/api/auth/session` endpoint still returns no user.

**Root Cause:** NextAuth only creates sessions through its normal OAuth flow (via `/api/auth/callback/discord` with cookie validation). Our custom iOS flow bypasses that.

**Options to Fix:**

#### Option A: Custom Session Token (Recommended)
Create a session token in the ios-callback endpoint:
```typescript
// In ios-callback endpoint, after getting user info:
const token = jwt.sign(
  { userId: user.id, discordId: user.id },
  process.env.NEXTAUTH_SECRET,
  { expiresIn: '7d' }
);

// Set as cookie that app can use
response.cookies.set('next-auth.session-token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60,
});
```

#### Option B: Custom Auth Endpoint
Create `/api/auth/ios-verify` that takes the userId and creates a session:
```typescript
// App calls after receiving deep link:
POST /api/auth/ios-verify
{ userId: "349349801076195329" }

// Returns NextAuth session cookie
```

#### Option C: Local Storage + Custom Session Management
Skip NextAuth session, use local app state:
```typescript
// In layout-auth-setup.tsx:
localStorage.setItem('discord-user', JSON.stringify({ id, name, avatar }));
// AuthStatus component reads from localStorage instead of NextAuth
```

**Recommendation:** Option A (Custom JWT Token) - maintains compatibility with NextAuth while bypassing the cookie issue.

---

### Issue 3: ngrok URL Changes
**Problem:** ngrok URL changes every time you restart it.

**How to Update:**
1. Start ngrok: `ngrok http 3000`
2. Copy new forwarding URL (e.g., `https://abc123.ngrok.app`)
3. Update two places:
   - **Discord Developer Portal:** OAuth2 → Redirect URLs → Update to `https://abc123.ngrok.app/api/auth/ios-callback`
   - **Code:** `src/lib/capacitor.ts` → `startDiscordLogin()` → Change `redirectUri` line
4. Rebuild: `NODE_ENV=development npx cap sync ios && npm run dev`

**For Production:** Use permanent domain `https://nickelcityxwing.com/api/auth/ios-callback`

---

### Issue 4: macOS Hidden Files
**Problem:** `.env.local` and `.gitignore` are hidden files on macOS and can't be edited in Finder.

**Solution:** Use terminal or let Claude handle it:
```bash
# View hidden files
cat /path/to/.env.local

# Edit with terminal
nano /path/to/.env.local

# Or use Claude to edit
```

---

## Next Steps

### Immediate (Session Persistence)
**Priority: HIGH** - Needed for app to be functional

1. **Implement JWT Session Creation** (Option A above)
   - Modify `src/app/api/auth/ios-callback/route.ts`
   - Import `jsonwebtoken` package
   - Create JWT token with user info
   - Set as session cookie
   - Test by checking `/api/auth/session` returns user

2. **Test Session Persistence**
   - Authenticate via Discord
   - Reload app
   - Verify still logged in

3. **Handle Session Update in Deep Link**
   - Update `layout-auth-setup.tsx` to properly trigger session refresh
   - Consider polling `/api/auth/session` instead of just `updateSession()`

### Secondary (Push Notifications)
**Priority: MEDIUM** - Needed for full feature parity

1. **Get APNS Certificate**
   - Go to Apple Developer account
   - Request APNs certificate for app
   - Download and install

2. **Configure Capacitor Push Plugin**
   - Install: Already done (`@capacitor/push-notifications`)
   - Add native iOS config

3. **Create Push Backend**
   - Modify push notification endpoints to support APNs
   - Currently uses Web Push (PWA system)

### Tertiary (Production Ready)
**Priority: LOW** - Before App Store submission

1. **Update Redirect URIs**
   - Discord app: `https://nickelcityxwing.com/api/auth/ios-callback`
   - Remove ngrok dependency

2. **Test on Real Device**
   - Pair iPhone with Mac
   - Run on real device
   - Test WiFi connectivity

3. **App Store Submission**
   - Create Apple Developer account (if needed)
   - Generate app certificates
   - Submit to App Store

4. **Update URL Scheme Documentation**
   - Ensure `com.ncx.app://` is properly documented
   - Handle any other deep links needed

---

## Files Changed

### New Files Created
- `capacitor.config.ts` - Capacitor configuration
- `src/lib/capacitor.ts` - Capacitor utilities (Safari opening, deep links, etc.)
- `src/app/api/auth/ios-callback/route.ts` - Discord OAuth callback handler
- `src/app/api/auth/ios-session/route.ts` - Session confirmation endpoint (not fully implemented)
- `src/app/m/layout-auth-setup.tsx` - Deep link handler component
- `CAPACITOR_SETUP.md` - Quick setup guide
- `DISCORD_OAUTH_SETUP.md` - Discord OAuth configuration guide
- `ios/` directory - Full Xcode project

### Modified Files
- `src/app/m/components/AuthStatus.tsx` - Conditionally use custom OAuth for Capacitor
- `src/app/m/layout.tsx` - Added AuthSetup component for deep link handling
- `package.json` - Added Capacitor packages
- `package-lock.json` - Updated dependencies
- `.gitignore` → should exist as hidden file

### Key Code Snippets

#### Check if Running in Capacitor
```typescript
import { isCapacitor, isIOS } from '@/lib/capacitor';

if (isCapacitor()) {
  // Native app code
}

if (isIOS()) {
  // iOS-specific code
}
```

#### Open Link in Safari
```typescript
import { openInSafari } from '@/lib/capacitor';

await openInSafari('https://example.com');
```

#### Set Up Deep Link Handler
```typescript
import { setupDeeplinkHandler } from '@/lib/capacitor';

useEffect(() => {
  setupDeeplinkHandler((url) => {
    console.log('Received deep link:', url);
    // Handle the deep link
  });
}, []);
```

---

## Important URLs & Credentials

### Development URLs
- **App:** http://localhost:3000/m
- **Next.js Turbopack:** http://localhost:3000 (hot reload)
- **ngrok Tunnel:** https://d965e26a3d7b.ngrok.app (changes each restart)
- **Xcode Web Inspector:** http://127.0.0.1:4040 (ngrok dashboard)

### Discord OAuth
- **Discord App:** https://discord.com/developers/applications/1482998745854509117
- **Authorization Endpoint:** https://discord.com/api/oauth2/authorize
- **Token Endpoint:** https://discord.com/api/oauth2/token
- **User Endpoint:** https://discord.com/api/users/@me
- **Client ID:** 1482998745854509117
- **Client Secret:** nwEaD-NepRHV406itzHm6Nt8x9pCIMaD (stored in .env.local)

### Credentials in .env.local
```
DISCORD_CLIENT_ID=1482998745854509117
DISCORD_CLIENT_SECRET=nwEaD-NepRHV406itzHm6Nt8x9pCIMaD
NEXT_PUBLIC_DISCORD_CLIENT_ID=1482998745854509117
MYSQLPASSWORD=mChKvvEQzxWOKOBhPcYHltMyADqwhpWz
NEXTAUTH_SECRET=somerandomkeygeneratedwithopenssl
[... other vars ...]
```

### Production Domain
- **Domain:** https://nickelcityxwing.com
- **Will use:** https://nickelcityxwing.com/api/auth/ios-callback (update when deploying)

---

## Useful Commands

```bash
# Build Next.js
npm run build

# Start dev server
npm run dev

# Sync changes to Capacitor
NODE_ENV=development npx cap sync ios

# Open Xcode
NODE_ENV=development npx cap open ios

# Start ngrok tunnel (port 3000)
ngrok http 3000

# View .env.local (hidden file)
cat /Users/gregkash/Documents/GitHub/ncx/.env.local

# Edit .env.local
nano /Users/gregkash/Documents/GitHub/ncx/.env.local

# Check git status
git status

# View commits on this branch
git log --oneline

# Switch back to main
git checkout main
```

---

## Resuming This Work

### Quick Start (Next Session)
1. Switch to branch: `git checkout capacitor-ios`
2. Terminal 1: `ngrok http 3000` (note the URL)
3. Update Discord app redirect URL with new ngrok URL
4. Update `src/lib/capacitor.ts` with new ngrok URL
5. Terminal 2: `npm run dev`
6. Terminal 3: `NODE_ENV=development npx cap sync ios && NODE_ENV=development npx cap open ios`
7. Hit Play in Xcode

### What to Focus On
1. **Session Persistence** (Blocker - see "Known Issues")
2. Push Notifications (if needed)
3. Production deployment

### Testing Checklist
- [ ] App loads at localhost:3000/m
- [ ] "Sign in" button visible
- [ ] Tap opens Safari with Discord login
- [ ] User can authenticate with Discord
- [ ] Deep link received in app console ("Auth successful")
- [ ] User data logged (userId, userName)
- [ ] Session created (check `/api/auth/session`)
- [ ] Sign in button changes to show logged-in user

---

## Questions to Answer Before Continuing

1. **Session Strategy:** Which option to implement? (A: JWT Token, B: Custom endpoint, C: Local storage)
2. **Push Notifications:** Still needed? Get APNS certificate ready if yes.
3. **Timeline:** When's the deadline for App Store submission?
4. **Testing:** Access to real iPhone for testing, or simulator only?
5. **Deployment:** When moving to production, update Discord app with real domain.

---

**Last Commit:** `d03e4f5` - "Implement Discord OAuth with Safari for Capacitor iOS"
**Next Commit Should:** Implement session persistence solution
