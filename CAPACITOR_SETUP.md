# Capacitor iOS App Setup

This branch adds native iOS app support using Capacitor.

## Quick Start

### Development

1. **Start the Next.js dev server** (required for Capacitor to connect):
   ```bash
   npm run dev
   ```
   This runs on `http://localhost:3000` by default.

2. **In another terminal, sync and open iOS project**:
   ```bash
   npx cap sync ios
   npx cap open ios
   ```

3. **In Xcode**, select the simulator or device and hit Play to run.

### Production Build

1. **Build Next.js**:
   ```bash
   npm run build
   ```

2. **Sync to Capacitor**:
   ```bash
   npx cap sync ios
   ```

3. **In Xcode**, build and archive for App Store submission.

## Architecture

- **Web Layer**: Next.js app serving `/m/` mobile routes + API endpoints
- **Native Layer**: Capacitor wraps the web app and provides:
  - Native iOS permissions access
  - Push notifications (APNs)
  - Safari-based OAuth (Discord login)
  - App deeplinks

## Configuration

### Environment

The `capacitor.config.ts` automatically:
- Uses `localhost:3000` in development
- Uses `.next/standalone/public` in production
- Disables SplashScreen to avoid delays

### URLs & Routing

In development, the app loads from your local Next.js server. Make sure:
- Next.js is running (`npm run dev`)
- You can access `http://localhost:3000/m` in your browser
- The iOS simulator can reach localhost (it can by default)

## Discord OAuth Setup

Currently requires manual implementation. When you're ready:

1. Add a custom Discord callback handler that detects Capacitor
2. Open Discord auth in Safari using `openInSafari()` from `@/lib/capacitor`
3. Handle the OAuth callback via deeplinks

See `src/lib/capacitor.ts` for utility functions.

## Push Notifications

To enable push notifications:

1. Get APNS certificate from Apple Developer
2. Install `@capacitor/push-notifications`
3. Update the iOS project config with certificate info
4. Handle incoming notifications in your React components

This replaces the Web Push system (PWA) and uses Apple's native APNs.

## Plugins Included

- `@capacitor/push-notifications` - Native push
- `@capacitor/browser` - Open Safari for OAuth
- `@capacitor/app` - Handle deeplinks and app lifecycle

## Common Issues

**"Cannot reach localhost:3000"**
- Make sure `npm run dev` is running
- Check firewall settings
- Verify iOS simulator can access localhost (usually works by default)

**Blank screen on launch**
- Check Xcode console for errors
- Verify Next.js is building correctly (`npm run build`)
- Clear Capacitor cache: `npx cap sync ios --deployment`

**OAuth not working**
- Implement the custom Discord callback handler
- Register app deeplink scheme in Xcode settings
- Test with `openInSafari()` first

## Next Steps

1. ✅ Capacitor initialized
2. ✅ iOS platform added
3. ⏳ Implement Discord OAuth with Safari
4. ⏳ Set up push notifications with APNs
5. ⏳ Test app on real device
6. ⏳ Prepare for App Store submission
