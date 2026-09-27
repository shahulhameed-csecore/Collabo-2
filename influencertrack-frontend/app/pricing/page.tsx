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
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Start for free and upgrade when you are ready to scale.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left mt-12 mb-16">
            {/* Free Plan */}
            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800/60 shadow-sm relative">
              <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-400 mb-6 h-10">Perfect for small brands testing the waters.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-white">₹0</span>
                <span className="text-slate-500 font-medium">/ forever</span>
              </div>
              <ul className="space-y-4">
                {[
                  "Up to 5 campaigns per month",
                  "Basic WhatsApp AI Extractions",
                  "Email Reminders Only",
                  "Basic Creator List"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                    <span className="text-slate-600">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-slate-900 to-[#0A0F1C] p-8 rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
              
              <h3 className="text-xl font-bold text-white mb-2 relative z-10 flex items-center gap-2">
                Collabo Pro <Sparkles className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-sm text-slate-400 mb-6 h-10 relative z-10">Everything you need to scale influencer marketing profitably.</p>
              <div className="flex items-baseline gap-1 mb-6 relative z-10">
                <span className="text-4xl font-black text-white">₹300</span>
                <span className="text-slate-400 font-medium">/ month</span>
              </div>
              
              <ul className="space-y-4 relative z-10">
                {[
                  "Unlimited active campaigns",
                  "Priority Multimodal AI Extractions",
                  "Automated WhatsApp Reminders",
                  "Advanced Influencer CRM & History",
                  "Real-time ROI & Click Analytics",
                  "Premium Support"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                    <span className="text-emerald-400">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-1"
          >
            <Sparkles className="w-5 h-5" /> Start Your 14-Day Free Trial
          </Link>
        </div>
      </main>
    </div>
  );
}
