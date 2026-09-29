'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

export default function AutoLogoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    // 1. Sign out of Supabase
    await supabase.auth.signOut();
    
    // 2. Redirect the user to the login page
    router.push('/login');
    router.refresh(); // Force refresh to clear the Next.js client-side router cache
  }, [router, supabase]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Start a new 15-minute countdown
    timerRef.current = setTimeout(handleLogout, TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    // Start the timer immediately when the component mounts
    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    let throttleTimeout: NodeJS.Timeout | null = null;

    // Throttle activity updates to once every 1 second (1000ms) 
    // to prevent performance issues and excessive resets on every single pixel movement
    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000); 
      }
    };

    // Attach event listeners to the window
    events.forEach((event) => {
      // Use { passive: true } to prevent scroll blocking and improve performance
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup function to prevent memory leaks on unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  // Render children normally
  return <>{children}</>;
}
