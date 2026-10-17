'use client';

import { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './ArchitecturalGrid';

export function RoiCalculator() {
  const [creators, setCreators] = useState(30);
  const [avgCommercial, setAvgCommercial] = useState(20000);

  // Calculations
  const hoursSavedMonthly = Math.round(creators * 2.8);
  const payrollSavingsMonthly = Math.round(hoursSavedMonthly * 650); // ₹650/hr agency/brand staff rate
  const recoveredDeliverableSavingsMonthly = Math.round(creators * avgCommercial * 0.08); // 8% saved from prevented missed posts
  const totalMonthlySavings = payrollSavingsMonthly + recoveredDeliverableSavingsMonthly;
  const annualSavings = totalMonthlySavings * 12;
  const collaboAnnualCost = 3000; // Collabo Pro annual
  const roiMultiplier = Math.max(1, Math.round(annualSavings / collaboAnnualCost));

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const applyPreset = (c: number, val: number) => {
    setCreators(c);
    setAvgCommercial(val);
  };

  return (
    <section id="roi" className="relative py-28 lg:py-36 bg-[#05070B] overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Section Header */}
        <SectionEyebrow
          badge="Financial Model"
          title={
            <span>
              Quantify the Economic Value of <br className="hidden sm:inline" />
              Campaign Automation.
            </span>
          }
          description="Plug in your monthly creator volume and average payout to see how Collabo eliminates manual administrative waste while preventing lost campaign deliverables."
        />

        {/* Main Terminal Box */}
        <div className="max-w-5xl mx-auto rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden backdrop-blur-xl">
          
          {/* Terminal Titlebar */}
          <div className="h-12 px-6 bg-[#080B11] border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-sans text-slate-300 font-medium">
                Influencer Operations Valuation Model
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-sans text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Live Projection</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
            
            {/* ── LEFT: Interactive Controls (Col 1-6) ────────────────────────── */}
            <div className="lg:col-span-6 p-7 sm:p-9 space-y-8 bg-[#080C14]">
              
              {/* Presets Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-sans text-slate-400 font-medium">Presets:</span>
                <button
                  onClick={() => applyPreset(15, 12000)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-sans transition-colors font-medium",
                    creators === 15 && avgCommercial === 12000
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:text-white"
                  )}
                >
                  D2C Emerging (15)
                </button>
                <button
                  onClick={() => applyPreset(40, 25000)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-sans transition-colors font-medium",
                    creators === 40 && avgCommercial === 25000
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:text-white"
                  )}
                >
                  Growth Brand (40)
                </button>
                <button
                  onClick={() => applyPreset(100, 35000)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-sans transition-colors font-medium",
                    creators === 100 && avgCommercial === 35000
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:text-white"
                  )}
                >
                  Scale Agency (100)
                </button>
              </div>

              {/* Slider 1: Active Creators Managed */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-baseline">
                  <div>
                    <label className="text-sm font-sans font-medium text-slate-100">
                      Active Creators Managed / Month
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5 font-sans font-normal">
                      Total influencers contracted across all channels.
                    </p>
                  </div>
                  <span className="text-2xl font-mono font-medium text-emerald-400 tabular-nums">
                    {creators}
                  </span>
                </div>

                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={creators}
                  onChange={(e) => setCreators(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-[#161D2F] rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />

                <div className="flex justify-between text-xs font-sans text-slate-400">
                  <span>5 Creators</span>
                  <span>100 Creators</span>
                  <span>200 Creators</span>
                </div>
              </div>

              {/* Slider 2: Average Commercial Payout */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-baseline">
                  <div>
                    <label className="text-sm font-sans font-medium text-slate-100">
                      Average Commercial per Creator
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5 font-sans font-normal">
                      Blended budget per creator (Reel + Stories/Shorts).
                    </p>
                  </div>
                  <span className="text-2xl font-mono font-medium text-white tabular-nums">
                    {formatINR(avgCommercial)}
                  </span>
                </div>

                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="2500"
                  value={avgCommercial}
                  onChange={(e) => setAvgCommercial(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-[#161D2F] rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />

                <div className="flex justify-between text-xs font-sans text-slate-400">
                  <span>₹5,000</span>
                  <span>₹50,000</span>
                  <span>₹1,00,000</span>
                </div>
              </div>

              {/* Methodology Explainer */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 font-sans leading-relaxed">
                <strong className="text-slate-200 block mb-1 font-medium">
                  Calculation Benchmarks:
                </strong>
                Assumes 2.8 hours saved per creator by removing manual WhatsApp chasing and spreadsheet logging (valued at ₹650/hr), plus recovering 8% of campaign budget otherwise lost to missed deadlines.
              </div>
            </div>

            {/* ── RIGHT: Financial Outputs & Value Metrics (Col 7-12) ─────────── */}
            <div className="lg:col-span-6 p-7 sm:p-9 bg-[#0A0E17] flex flex-col justify-between">
              <div>
                <div className="text-xs font-sans text-slate-400 uppercase tracking-wider mb-2 font-medium">
                  Projected Annual Value Delivered
                </div>

                {/* Big Hero Metric */}
                <div className="mb-7">
                  <div className="text-4xl sm:text-5xl font-mono font-medium text-emerald-400 tabular-nums tracking-tight">
                    {formatINR(annualSavings)}
                  </div>
                  <div className="text-xs font-sans text-slate-400 mt-1.5 flex items-center gap-1.5 font-normal">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Estimated Net Economic Value per Year</span>
                  </div>
                </div>

                {/* Submetrics Breakdown Matrix */}
                <div className="grid grid-cols-2 gap-3.5 mb-7">
                  <div className="p-4 rounded-xl bg-[#080C14] border border-white/[0.06]">
                    <div className="text-xs font-sans text-slate-400">
                      Hours Saved / Mo
                    </div>
                    <div className="text-2xl font-mono font-medium text-white tabular-nums mt-1">
                      {hoursSavedMonthly} hrs
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      Eliminated manual data entry
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080C14] border border-white/[0.06]">
                    <div className="text-xs font-sans text-slate-400">
                      Payroll Saved / Mo
                    </div>
                    <div className="text-2xl font-mono font-medium text-emerald-400 tabular-nums mt-1">
                      {formatINR(payrollSavingsMonthly)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      Ops bandwidth restored
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080C14] border border-white/[0.06]">
                    <div className="text-xs font-sans text-slate-400">
                      Missed Posts Saved
                    </div>
                    <div className="text-xl font-mono font-medium text-white tabular-nums mt-1">
                      {formatINR(recoveredDeliverableSavingsMonthly)}/mo
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      Via 48h automated chasers
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080C14] border border-white/[0.06]">
                    <div className="text-xs font-sans text-slate-400">
                      Value Multiplier
                    </div>
                    <div className="text-xl font-mono font-medium text-emerald-400 tabular-nums mt-1">
                      {roiMultiplier}x ROI
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-sans">
                      Collabo Pro costs ₹300/mo
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Conversion Row */}
              <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-sans text-slate-200 font-medium">
                    Collabo Pro: ₹300 / month
                  </div>
                  <div className="text-xs text-slate-400 font-sans font-normal">
                    Includes 14-day free trial • Cancel anytime
                  </div>
                </div>

                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-sans font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all shadow-md"
                >
                  <span>Claim Your ROI Now</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
