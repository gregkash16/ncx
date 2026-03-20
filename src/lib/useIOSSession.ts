import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { isCapacitor } from './capacitor';

// Global event emitter for session updates
let sessionUpdateListener: (() => void) | null = null;

export function triggerSessionRefresh() {
  if (sessionUpdateListener) {
    sessionUpdateListener();
  }
}

/**
 * Custom hook that uses NextAuth session if available,
 * otherwise checks the iOS custom session cookie
 */
export function useIOSSession() {
  const nextAuthSession = useSession();
  const [iosSession, setIOSSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch iOS session
  const checkIOSSession = async () => {
    if (nextAuthSession.data?.user) {
      return; // NextAuth session already available
    }

    if (!isCapacitor()) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/ios-session');
      const data = await res.json();
      if (data.user) {
        console.log('iOS session loaded:', data.user.name);
        setIOSSession(data);
      }
    } catch (error) {
      console.error('Failed to check iOS session:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check iOS session on mount and when refresh is triggered
  useEffect(() => {
    checkIOSSession();
  }, [nextAuthSession.data?.user, refreshTrigger]);

  // Set up global refresh listener
  useEffect(() => {
    sessionUpdateListener = () => {
      console.log('Triggering iOS session refresh');
      setRefreshTrigger((prev) => prev + 1);
    };
  }, []);

  // Return NextAuth session if available, otherwise iOS session
  const session = nextAuthSession.data || iosSession;

  return {
    data: session,
    status: nextAuthSession.status === 'loading' || loading ? 'loading' : nextAuthSession.status,
  };
}
