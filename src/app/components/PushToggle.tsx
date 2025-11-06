// src/app/components/PushToggle.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Status = 'checking' | 'on' | 'off' | 'blocked' | 'error';

export default function PushToggle() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>('checking');
  const [msg, setMsg] = useState<string>('');

  useEffect(() => setMounted(true), []);

  // Compute environment only after mount to avoid SSR/CSR mismatch
  const env = useMemo(() => {
    if (!mounted) return { isIOS: false, isStandalone: false, canUseWebPush: false };
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      
      (navigator as any).standalone === true;
    const baseline = 'serviceWorker' in navigator && 'PushManager' in window;
    const canUseWebPush = baseline && (!isIOS || (isIOS && isStandalone));

    // Quick visibility in PWA: check console in mobile Safari via remote inspector (or logcat on Android)
    console.log('[PushToggle] env', { isIOS, isStandalone, baseline, canUseWebPush });

    return { isIOS, isStandalone, canUseWebPush };
  }, [mounted]);

  // Stable label
  const label =
    status === 'checking' ? 'Checking…' :
    status === 'on'       ? 'Disable notifications' :
    status === 'off'      ? (env.isIOS && !env.isStandalone ? 'Install app to enable notifications' : 'Enable notifications') :
    status === 'blocked'  ? 'Notifications blocked' :
                            'Try again';

  // Initial check
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    (async () => {
      try {
        // We *still* render the button even if canUseWebPush is false; just set 'off' so label shows the hint.
        const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
        if (perm === 'denied') {
          if (!cancelled) setStatus('blocked');
          return;
        }
        if (!('serviceWorker' in navigator)) {
          if (!cancelled) { setStatus('error'); setMsg('SW unsupported'); }
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? 'on' : 'off');
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setMsg(e?.message || 'Failed to check push status');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mounted]);

  async function enablePush() {
    try {
      setStatus('checking'); setMsg('');

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('error'); setMsg('Push not supported'); return;
      }

      // Force SW update when testing on phone
      const reg = await navigator.serviceWorker.register('/sw.js?v=3');

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'blocked' : 'off'); return;
      }

      const resp = await fetch('/api/push/vapidPublicKey', { cache: 'no-store' });
      if (!resp.ok) throw new Error('Failed to fetch VAPID key');
      const { key } = await resp.json();
      if (!key) throw new Error('Missing VAPID key');

      const sub = (await reg.pushManager.getSubscription()) ||
                  (await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(key),
                  }));

      const save = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      if (!save.ok) throw new Error('Failed to save subscription');

      setStatus('on');
    } catch (e: any) {
      setStatus('error'); setMsg(e?.message || 'Failed to enable notifications');
    }
  }

  async function disablePush() {
    try {
      setStatus('checking'); setMsg('');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (e: any) {
      setStatus('error'); setMsg(e?.message || 'Failed to disable notifications');
    }
  }

  function handleClick() {
    if (status === 'checking') return;
    // If iOS and not standalone (Safari tab), show hint but keep disabled below
    if (env.isIOS && !env.isStandalone) return;
    if (status === 'on')  return void disablePush();
    if (status === 'off' || status === 'error') return void enablePush();
    if (status === 'blocked') alert('Notifications are blocked. Enable them in Settings for this app/site.');
  }

  // Before mount: neutral placeholder to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="inline-flex items-center justify-center gap-2 px-4 py-2 min-w-[13.5rem] rounded-xl border border-purple-500/40 bg-zinc-900 text-white opacity-70">
        <BellIcon /> <span className="font-semibold">Notifications</span>
      </div>
    );
  }

  const disabled =
    status === 'checking' ||
    (env.isIOS && !env.isStandalone); // installed requirement on iOS

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 px-4 py-2 min-w-[13.5rem]',
        'rounded-xl border shadow-lg transition-transform duration-200 text-white',
        disabled
          ? 'opacity-70 cursor-not-allowed border-zinc-600 bg-zinc-800'
          : status === 'on'
          ? 'border-emerald-500/40 bg-emerald-900/30 hover:scale-105'
          : status === 'blocked'
          ? 'border-red-500/40 bg-red-900/30'
          : 'border-purple-500/40 bg-zinc-900 hover:scale-105',
      ].join(' ')}
      aria-live="polite"
      title={msg || (status === 'on' ? 'Notifications enabled' : 'Enable match updates')}
    >
      <BellIcon filled={status === 'on'} blocked={status === 'blocked'} />
      <span className="font-semibold">{label}</span>
    </button>
  );
}

/* utils */
function urlBase64ToUint8Array(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function BellIcon({ filled, blocked }: { filled?: boolean; blocked?: boolean }) {
  if (blocked) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm9-6V11a9 9 0 1 0-18 0v5l-2 2v1h22v-1l-2-2Zm-4.59-7.59L6.41 18.41L5 17l10-10l1.41 1.41Z" />
      </svg>
    );
  }
  return filled ? (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h18v-1l-2-2Z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2ZM6 16V11a6 6 0 1 1 12 0v5l2 2v1H4v-1l2-2Z" />
    </svg>
  );
}
