import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 text-center selection:bg-emerald-500/30 selection:text-emerald-300">
      <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-card/50 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-center mb-6">
          <Logo variant="full" size={28} href="/" />
        </div>

        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-6">
          <Compass className="w-7 h-7 animate-pulse" />
        </div>

        <span className="inline-block text-[11px] font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
          404 Error
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Page Not Found
        </h1>

        <p className="text-sm text-muted-foreground mb-8">
          The page or collaboration you are looking for doesn't exist, has been moved, or the link has expired.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-xs font-medium transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
