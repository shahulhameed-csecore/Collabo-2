'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Clock, 
  MousePointerClick, 
  FileVideo, 
  RefreshCw,
  Sparkles,
  CheckCircle2,
  BellRing
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './ArchitecturalGrid';

export function BentoBenefits() {
  // Cell 1: Magic Proof state
  const [proofUploaded, setProofUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Cell 3: Live Click Counter & CPC
  const [clicks, setClicks] = useState(42);
  const [cpcCost] = useState(15000);
  const cpc = (cpcCost / clicks).toFixed(2);

  // Cell 2: WhatsApp Cron active step with sequential auto-pulse
  const [activeCronStep, setActiveCronStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const cronTimer = setInterval(() => {
      setActiveCronStep((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 3200);
    return () => clearInterval(cronTimer);
  }, []);

  const simulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setProofUploaded(true);
    }, 850);
  };

  const handleTestClick = () => {
    setClicks((prev) => prev + 1);
  };

  return (
    <section id="workbench" className="relative py-28 lg:py-36 bg-[#05070B] overflow-hidden border-t border-white/[0.06]">
      
      {/* Soft atmospheric radial spotlight */}
      <div className="absolute top-1/4 right-0 w-[600px] h-[500px] bg-emerald-500/[0.06] blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Left-Aligned Header with Varied Rhythm & Right-Side Live Status */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16 md:mb-20">
          <div className="text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-sans text-xs font-medium mb-5 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tactical Workbench</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-[-0.03em] leading-[1.12] text-gradient-metallic mb-5">
              Engineered for Complete Campaign Autonomy.
            </h2>

            <p className="text-base sm:text-lg text-slate-400 leading-relaxed font-sans font-normal">
              Four tactical subsystems designed from first principles to eliminate manual spreadsheets, endless follow-ups, and unverified payments.
            </p>
          </div>

          {/* Subtle Right-side Live Status Indicator on Desktop */}
          <div className="hidden lg:flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] backdrop-blur-md shadow-sm shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <div className="text-xs font-sans">
              <div className="text-slate-200 font-medium flex items-center gap-2">
                <span>Autonomous Engine</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">ACTIVE</span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">4 Subsystems Synchronized</div>
            </div>
          </div>
        </div>

        {/* 12-Column Asymmetric Bento Grid: Row 1 (7+5), Row 2 (5+7) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── CELL 1: Frictionless Magic Link Proofs (Col 1-7) ─────────────── */}
          <motion.div
            whileHover={{ y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
            className="group relative overflow-hidden lg:col-span-7 rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] hover:border-emerald-500/30 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_24px_rgba(16,185,129,0.08)] p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl transition-all duration-300"
          >
            {/* Subtle radial mouse-hover spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_0%,rgba(16,185,129,0.08),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium">
                    Zero App Required
                  </span>
                  <span className="text-xs font-sans text-slate-400">Mobile Web Optimized</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-medium text-slate-100 tracking-[-0.02em] mb-2 font-sans">
                  Frictionless Magic Links for Creators.
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6 font-normal">
                  Never force creators to download an app or remember passwords. They receive a secure tokenized link on WhatsApp to drag-and-drop raw video drafts, screenshots, and live post URLs.
                </p>

                {/* Interactive Mini-Preview of /submit-proof/[token] */}
                <div className="rounded-xl bg-[#060A12] border border-white/[0.06] p-4.5 font-sans">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-white/[0.04] mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono font-medium">GET</span>
                      <span className="font-mono text-slate-300">/submit-proof/tok_89f2a4</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">Creator View</span>
                  </div>

                  <div className="p-5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-center">
                    {!proofUploaded ? (
                      <div className="space-y-3">
                        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto text-slate-300">
                          {isUploading ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-200 font-medium">
                            {isUploading ? 'Uploading proof to Supabase storage...' : 'Drop Instagram Reel or screenshot'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Direct S3 chunked upload • Up to 250MB
                          </div>
                        </div>
                        <button
                          onClick={simulateUpload}
                          disabled={isUploading}
                          className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium transition-colors"
                        >
                          {isUploading ? 'Simulating...' : 'Simulate Creator Upload'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-200 font-sans">
                            <FileVideo className="w-4 h-4 text-emerald-400" />
                            <span className="font-medium">Reel_Final_V2_ColorGraded.mp4</span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Version 2 • In Review
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/[0.04]">
                          <span>Uploaded just now (1080x1920 MP4)</span>
                          <button
                            onClick={() => setProofUploaded(false)}
                            className="text-slate-400 hover:text-slate-200 underline text-xs"
                          >
                            Reset Demo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Security: <strong className="font-normal text-emerald-400">Encrypted Token</strong></span>
                <span>Expires in 30 days</span>
              </div>
            </div>
          </motion.div>

          {/* ── CELL 2: Autonomous 48h WhatsApp Chaser (Col 8-12) ───────────── */}
          <motion.div
            whileHover={{ y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
            className="group relative overflow-hidden lg:col-span-5 rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] hover:border-emerald-500/30 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_24px_rgba(16,185,129,0.08)] p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl transition-all duration-300"
          >
            {/* Subtle radial mouse-hover spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_0%,rgba(16,185,129,0.08),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium">
                  Automated Scheduler
                </span>
                <span className="flex items-center gap-1.5 text-xs font-sans text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Cron Active
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-medium text-slate-100 tracking-[-0.02em] mb-2 font-sans">
                Autonomous 48h WhatsApp Chaser.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6 font-normal">
                Our scheduler watches campaign delivery timestamps and dispatches polite WhatsApp nudges automatically—saving your team from manual nagging.
              </p>

              {/* Pulsing Sequenced Timeline */}
              <div className="space-y-3 text-xs font-sans">
                
                <div 
                  onClick={() => setActiveCronStep(0)}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                    activeCronStep === 0 
                      ? "bg-[#101828] border-emerald-500/40 shadow-sm"
                      : "bg-[#060A12] border-white/[0.04] text-slate-400 hover:border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-100 flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", activeCronStep === 0 ? "bg-emerald-400 animate-ping" : "bg-slate-600")} />
                      T - 48 Hours: Friendly Nudge
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono">10:00 AM</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-4 font-sans leading-relaxed">
                    "Hey Rohan! Quick reminder from the brand team: Your Instagram Reel is due in 48 hours."
                  </p>
                </div>

                <div 
                  onClick={() => setActiveCronStep(1)}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                    activeCronStep === 1 
                      ? "bg-[#101828] border-amber-500/40 shadow-sm"
                      : "bg-[#060A12] border-white/[0.04] text-slate-400 hover:border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-100 flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", activeCronStep === 1 ? "bg-amber-400 animate-ping" : "bg-slate-600")} />
                      T - 0 Hours: Go-Live Check
                    </span>
                    <span className="text-[11px] text-amber-300 font-mono">Launch Day</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-4 font-sans leading-relaxed">
                    Auto-verifies uploaded proof link. If missing, triggers gentle escalation to creator.
                  </p>
                </div>

                <div 
                  onClick={() => setActiveCronStep(2)}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                    activeCronStep === 2 
                      ? "bg-[#101828] border-rose-500/40 shadow-sm"
                      : "bg-[#060A12] border-white/[0.04] text-slate-400 hover:border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-100 flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", activeCronStep === 2 ? "bg-rose-400 animate-ping" : "bg-slate-600")} />
                      Overdue Recovery Alert
                    </span>
                    <span className="text-[11px] text-rose-400 font-mono">Escalation</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-4 font-sans leading-relaxed">
                    Flags campaign in your dashboard notification center and freezes pending payouts.
                  </p>
                </div>

              </div>
            </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Channel: WhatsApp Bot</span>
                <span className="font-mono text-emerald-400">98.2% Open Rate</span>
              </div>
            </div>
          </motion.div>

          {/* ── CELL 3: Affiliate Shortlinks & Real-Time CPC (Col 1-5, Row 2) ─── */}
          <motion.div
            whileHover={{ y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
            className="group relative overflow-hidden lg:col-span-5 rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] hover:border-emerald-500/30 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_24px_rgba(16,185,129,0.08)] p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl transition-all duration-300"
          >
            {/* Subtle radial mouse-hover spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_0%,rgba(16,185,129,0.08),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium">
                    Attribution Engine
                  </span>
                  <span className="text-xs font-sans text-emerald-400">Real-Time CPC</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-medium text-slate-100 tracking-[-0.02em] mb-2 font-sans">
                  Affiliate Shortlinks & CPC ROI.
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6 font-normal">
                  Stop guessing which creator drove actual buyers. Collabo generates branded tracking shortlinks that log unique clicks and dynamically calculate Cost-Per-Click.
                </p>

                {/* Interactive Click Matrix */}
                <div className="p-4.5 rounded-xl bg-[#060A12] border border-white/[0.06] font-sans space-y-4">
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-white/[0.04]">
                    <span className="text-slate-400 font-medium">Shortlink:</span>
                    <span className="font-mono text-emerald-400 font-medium">mycollabo.online/t/riya12</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[11px] text-slate-400 font-medium">Unique Clicks</div>
                      <div className="text-2xl font-mono font-medium text-white tabular-nums mt-0.5">
                        {clicks}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[11px] text-slate-400 font-medium">Computed CPC</div>
                      <div className="text-2xl font-mono font-medium text-emerald-400 tabular-nums mt-0.5">
                        ₹{cpc}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleTestClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-sans font-medium text-emerald-300 active:scale-[0.98] transition-all"
                  >
                    <MousePointerClick className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Simulate Link Click (+1)</span>
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Agreed Fee: <strong className="font-mono text-slate-200">₹15,000</strong></span>
                <span>Redirect latency: 18ms</span>
              </div>
            </div>
          </motion.div>

          {/* ── CELL 4: Creator CRM & Reliability Ledger (Col 6-12, Row 2) ────── */}
          <motion.div
            whileHover={{ y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } }}
            className="group relative overflow-hidden lg:col-span-7 rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] hover:border-emerald-500/30 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),0_0_24px_rgba(16,185,129,0.08)] p-7 sm:p-8 flex flex-col justify-between backdrop-blur-xl transition-all duration-300"
          >
            {/* Subtle radial mouse-hover spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_0%,rgba(16,185,129,0.08),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium">
                    Historical CRM Ledger
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-sans font-medium">
                    Reliability Grade A+
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-medium text-slate-100 tracking-[-0.02em] mb-2 font-sans">
                  Creator CRM & Commercial Ledger.
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6 font-normal">
                  Build institutional memory for your brand. Record lifetime payouts, past turnaround speeds, negotiation notes, and verified creator tax identifiers in one confidential terminal.
                </p>

                {/* Creator Ledger Record Card */}
                <div className="p-4.5 rounded-xl bg-[#060A12] border border-white/[0.06] font-sans text-xs space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-semibold text-xs">
                        AF
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-slate-100">@ananya_fitness</div>
                        <div className="text-[11px] text-slate-400">Fitness & Wellness • Delhi NCR</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-medium text-sm tabular-nums">96% On-Time</span>
                      <div className="text-[11px] text-slate-400">12 / 12 campaigns</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-slate-400 text-[11px]">Total Spend</div>
                      <div className="text-white font-mono font-medium tabular-nums mt-0.5">₹1,80,000</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-slate-400 text-[11px]">Avg Turnaround</div>
                      <div className="text-white font-mono font-medium tabular-nums mt-0.5">38 Hours</div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-slate-400 text-[11px]">Repeat ROI</div>
                      <div className="text-emerald-400 font-medium mt-0.5">High Conversion</div>
                    </div>
                  </div>

                  {/* Private Brand Notes */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-300 font-sans leading-relaxed">
                    <span className="text-slate-400 text-[11px] font-medium block mb-1">
                      Private Brand Negotiation Dossier:
                    </span>
                    “Accepts 15% discount for quarterly upfront commitments. Best performing reels are posted Sunday evenings 7 PM. Prompt on invoice submissions.”
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Security: End-to-End Encrypted</span>
                <span>1-Click CSV Export</span>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
