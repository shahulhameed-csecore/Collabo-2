'use client';

import { Inter } from 'next/font/google';
import { AlertCircle, RefreshCw } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 min-h-screen flex items-center justify-center`}>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl m-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Critical System Error
          </h1>
          
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            The application encountered a critical error. We apologize for the inconvenience.
          </p>

          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Restart Application
          </button>
        </div>
      </body>
    </html>
  );
}
