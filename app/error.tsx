'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, LayoutDashboard } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Next.js Error Boundary Caught:', error);
  }, [error]);

  const isNetworkError = error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network');

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
        </h1>
        
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          {isNetworkError 
            ? "We couldn't reach the server. Please check your internet connection and try again."
            : "An unexpected error occurred while loading this page. Our team has been notified."}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              <Home className="w-4 h-4" /> Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
