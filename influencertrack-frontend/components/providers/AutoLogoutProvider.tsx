'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const STORAGE_KEY = 'lastActivityTime';

export default function AutoLogoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  
  // Prevent duplicate logout execution if triggered simultaneously
  const isLoggingOut = useRef(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    try {
      // 1. Clear storage immediately to notify background tabs to also log out
      localStorage.removeItem(STORAGE_KEY);
      
      // 2. Securely attempt to clear the Supabase session
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during auto-logout:', error);
    } finally {
      // 3. Guarantee redirect happens even if Supabase network request fails
      router.push('/login');
      router.refresh();
    }
  }, [router, supabase]);

  useEffect(() => {
    // 1. Initialize or update activity time
    const updateActivityTime = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };
    
    // Set initial timestamp on mount if it doesn't exist
    if (!localStorage.getItem(STORAGE_KEY)) updateActivityTime();

    // 2. Heartbeat interval: Checks time across ALL tabs
    const checkInactivity = () => {
      const lastActivityStr = localStorage.getItem(STORAGE_KEY);
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (Date.now() - lastActivity >= TIMEOUT_MS) {
          handleLogout();
        }
      } else {
        // If the key is suddenly missing, another tab executed a logout
        handleLogout();
      }
    };

    // Check every second. This replaces the volatile setTimeout.
    const intervalId = setInterval(checkInactivity, 1000);

    // 3. Throttle physical DOM activity updates
    let throttleTimeout: NodeJS.Timeout | null = null;
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    
    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          updateActivityTime();
          throttleTimeout = null;
        }, 1000); // 1-second throttle
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // 4. Listen for instant storage changes (e.g., Tab A logs out, Tab B immediately catches it)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && !e.newValue) {
        handleLogout();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 5. Bulletproof cleanup
    return () => {
      clearInterval(intervalId);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleLogout]);

  return <>{children}</>;
}
