'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Zap, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './ArchitecturalGrid';

export function PremiumPricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const starterFeatures = [
    "Up to 5 active campaigns per month",
    "Magic Link proof uploads for creators",
    "Core campaign table & status tracking",
    "Manual commercial & date logging",
    "Basic email support"
  ];

  const proFeatures = [
    "Unlimited active influencer campaigns",
    "Unlimited Gemini AI WhatsApp extraction (voice, DMs, PDFs)",
    "Autonomous 48h WhatsApp & Email deadline chasers",
    "Real-time affiliate shortlink click & CPC attribution",
    "1-Click PDF & Excel monthly accounting exports",
    "Multi-version proof history & raw file verification",
    "Dedicated WhatsApp bot phone number integration",
    "Priority founder support via WhatsApp"
  ];

  return (
    <section id="pricing" className="relative py-28 lg:py-36 bg-[#05070B] overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Section Header */}
        <SectionEyebrow
          badge="Pricing & Plans"
          title={
            <span>
              Simple, Transparent Pricing. <br className="hidden sm:inline" />
              Built for High-Velocity Teams.
            </span>
          }
          description="Every plan includes a 14-day full feature trial. No credit card required. Cancel anytime with a single click."
        />

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-14">
          <div className="inline-flex items-center p-1 rounded-full bg-[#0A0E17] border border-white/[0.08] shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-sans font-medium transition-all duration-150",
                billingCycle === 'monthly'
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-full text-xs font-sans font-medium transition-all duration-150",
                billingCycle === 'annual'
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* 2-Card Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          
          {/* ── CARD 1: STARTER TIER ────────────────────────────────────────── */}
          <div className="rounded-2xl bg-[#0A0E17]/80 border border-white/[0.07] p-8 sm:p-9 flex flex-col justify-between shadow-[0_16px_40px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-sans text-slate-400 font-medium uppercase tracking-wider">
                  Starter Tier
                </div>
                <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-400 font-medium">
                  Free Forever
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-mono font-medium text-white tabular-nums">
                    ₹0
                  </span>
                  <span className="text-sm font-sans text-slate-400">
                    / forever
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-sans font-normal leading-relaxed">
                  Ideal for solo founders testing influencer partnerships with up to 5 campaigns monthly.
                </p>
              </div>

              <div className="space-y-3.5 pt-6 border-t border-white/[0.06] mb-8 font-sans">
                {starterFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs text-slate-300">
                    <Check className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="font-normal">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/signup"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-sans font-medium text-slate-200 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] transition-all"
            >
              <span>Start Free Forever</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* ── CARD 2: COLLABO PRO TIER (HERO TIER) ────────────────────────── */}
          <div className="relative rounded-2xl bg-[#0A0E17]/90 border border-emerald-500/30 border-t-2 border-t-emerald-400 p-8 sm:p-9 flex flex-col justify-between shadow-[0_20px_50px_-20px_rgba(16,185,129,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
            
            {/* Clean Centered Floating Top-Border Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-emerald-400 text-[#05070B] text-xs font-sans font-semibold tracking-wide shadow-md whitespace-nowrap uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Most Popular • 14-Day Free Trial</span>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-sans text-emerald-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Collabo Pro</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-mono font-medium text-white tabular-nums">
                    {billingCycle === 'monthly' ? '₹300' : '₹3,000'}
                  </span>
                  <span className="text-sm font-sans text-slate-400">
                    {billingCycle === 'monthly' ? '/ month' : '/ year (₹250/mo)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-sans font-normal leading-relaxed">
                  The complete autonomous operating system for D2C brands and growing creator marketing agencies.
                </p>
              </div>

              <div className="space-y-3.5 pt-6 border-t border-white/[0.06] mb-8 font-sans">
                {proFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="font-normal">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Link
                href="/signup"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-sans font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(16,185,129,0.3)]"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <div className="text-xs font-sans text-slate-400 text-center mt-3 font-normal">
                Zero commitment • Instant cancellation anytime
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
