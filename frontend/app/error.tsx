'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-center shadow-sm animate-fade-in w-full max-w-2xl mx-auto mt-12">
      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-500/20">
        <AlertCircle className="w-8 h-8 text-rose-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
      <p className="text-slate-500 max-w-md mb-8">
        We encountered an error while loading this component. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}
