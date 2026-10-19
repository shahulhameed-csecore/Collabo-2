'use client';

import { ArrowRight, MessageSquare, Sparkles, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function FinalCta() {
  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+91 6374771074";
  const cleanNumber = botNumber.replace(/[^0-9]/g, '');
  const waUrl = `https://wa.me/${cleanNumber}?text=Hi%20Collabo%20team,%20I'd%20like%20to%20learn%20more%20about%20the%20AI%20Influencer%20CRM`;

  return (
    <section className="relative py-28 sm:py-36 bg-[#05070B] overflow-hidden border-t border-white/[0.06]">
      
      {/* Atmospheric lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(16,185,129,0.12),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Architectural Card with generous padding and soft borders */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#0A0E17]/90 to-[#070A10]/90 border border-white/[0.08] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-8 sm:p-16 text-center overflow-hidden backdrop-blur-xl">
          
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-xs font-sans font-medium text-emerald-400 mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Deploy in 2 Minutes</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-medium tracking-[-0.03em] leading-[1.12] max-w-3xl mx-auto mb-6 text-gradient-metallic font-sans">
            Ready to retire the <br className="hidden sm:inline" />
            campaign spreadsheet?
          </h2>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 font-sans font-normal leading-relaxed">
            Join modern Indian D2C brands and agencies automating their creator negotiations, magic proof collection, and deadline follow-ups with Collabo.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-9">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-sans font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(16,185,129,0.3)]"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-sans font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Talk to Founders on WhatsApp</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-sans text-slate-400 font-normal">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              No Credit Card Required
            </span>
            <span>•</span>
            <span>14-Day Pro Access</span>
            <span>•</span>
            <span>Dedicated WhatsApp Bot Number</span>
          </div>

        </div>

      </div>
    </section>
  );
}
