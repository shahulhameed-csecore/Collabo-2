'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Sparkles } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={32} href="/" />
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex items-center justify-center rounded-xl text-xs font-semibold bg-white text-slate-950 hover:bg-slate-200 h-9 px-4 shadow-sm transition-colors">
              Try for Free
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16 relative">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none opacity-50 mix-blend-screen" />
           
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
            Pricing Coming Soon!
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Enjoy full access to all premium features completely free during our testing phase. No credit card required.
          </p>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-1"
          >
            <Sparkles className="w-5 h-5" /> Start Using Collabo for Free
          </Link>
        </div>
      </main>
    </div>
  );
}
