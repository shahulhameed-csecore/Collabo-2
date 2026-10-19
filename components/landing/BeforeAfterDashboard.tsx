'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  FileSpreadsheet, 
  Bell, 
  Download, 
  Clock, 
  ShieldAlert, 
  Zap, 
  Check, 
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './ArchitecturalGrid';

export function BeforeAfterDashboard() {
  const [activeView, setActiveView] = useState<'command' | 'chaos'>('command');

  return (
    <section id="architecture" className="relative py-28 lg:py-36 bg-[#05070B] overflow-hidden">
      
      {/* Decorative atmospheric depth */}
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Section Eyebrow with smooth typography and rounded-full pill */}
        <SectionEyebrow
          badge="Workflow Architecture"
          title={
            <span>
              The Operating System Upgrade Your <br className="hidden sm:inline" />
              Influencer Pipeline Deserves.
            </span>
          }
          description="Stop chasing creators across messy chats and spreadsheets."
        />

        {/* View Switcher Segmented Control */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 rounded-xl bg-[#0A0E17] border border-white/[0.08] shadow-sm">
            <button
              onClick={() => setActiveView('chaos')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans font-medium transition-all duration-150",
                activeView === 'chaos'
                  ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>State A: Legacy Spreadsheet Hell</span>
            </button>

            <button
              onClick={() => setActiveView('command')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans font-medium transition-all duration-150",
                activeView === 'command'
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>State B: Collabo Command Engine</span>
            </button>
          </div>
        </div>

        {/* Comparison Stage */}
        <div className="relative">
          <AnimatePresence mode="wait">
            
            {/* ── STATE A: MANUAL SPREADSHEET & WHATSAPP HELL ───────────────────── */}
            {activeView === 'chaos' && (
              <motion.div
                key="chaos-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl bg-[#090C12] border border-rose-500/20 shadow-[0_20px_50px_-20px_rgba(244,63,94,0.15)] overflow-hidden"
              >
                {/* Chaos Window Bar */}
                <div className="h-11 px-5 bg-[#0e0709] border-b border-rose-500/20 flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-2 text-rose-400/90 font-mono text-[11px]">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Q4_Influencer_Campaign_FINAL_FINAL_v7_copy(3).xlsx</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-sans text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span>4 Critical Errors • 19 Overdue Items</span>
                  </div>
                </div>

                {/* Broken Table Preview */}
                <div className="p-5 sm:p-7 overflow-x-auto text-xs font-sans">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-rose-500/20 text-slate-500 text-left text-xs">
                        <th className="pb-3.5 font-medium">Creator Channel</th>
                        <th className="pb-3.5 font-medium">Agreed Fee</th>
                        <th className="pb-3.5 font-medium">Due Date</th>
                        <th className="pb-3.5 font-medium">Follow-Up Status</th>
                        <th className="pb-3.5 font-medium">Proof Link</th>
                        <th className="pb-3.5 font-medium">Payment State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-slate-300">
                      
                      <tr className="bg-rose-950/20">
                        <td className="py-4">
                          <span className="font-mono font-semibold text-rose-200">@rohan_vlogs</span>
                          <div className="text-[11px] text-rose-400/80">WhatsApp voice note forgotten</div>
                        </td>
                        <td className="py-4 font-mono text-slate-400">₹15,000</td>
                        <td className="py-4 font-mono text-rose-400 font-medium">18 Oct (4 days overdue)</td>
                        <td className="py-4">
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-200 font-medium">
                            Ghosted in DMs
                          </span>
                        </td>
                        <td className="py-4 font-mono text-rose-400/50 line-through text-[11px]">drive.google.com/404-broken</td>
                        <td className="py-4 text-amber-300 text-[11px]">Paid advance? Unknown</td>
                      </tr>

                      <tr className="bg-slate-900/30">
                        <td className="py-4">
                          <span className="font-mono font-semibold text-slate-200">@priya_glow</span>
                          <div className="text-[11px] text-slate-400">Agreed via DM screenshot</div>
                        </td>
                        <td className="py-4 font-mono text-rose-400 font-bold">#REF! ERROR</td>
                        <td className="py-4 font-mono text-slate-300">02 Nov 2026</td>
                        <td className="py-4 text-slate-400">Manual ping required</td>
                        <td className="py-4 text-slate-400">Missing in WhatsApp history</td>
                        <td className="py-4 text-slate-400">Pending verification</td>
                      </tr>

                      <tr className="bg-rose-950/10">
                        <td className="py-4">
                          <span className="font-mono font-semibold text-slate-200">@tech_kabir</span>
                          <div className="text-[11px] text-slate-400">Contract lost in Gmail</div>
                        </td>
                        <td className="py-4 font-mono text-slate-300">₹45,000</td>
                        <td className="py-4 font-mono text-amber-400">Tomorrow 18:00</td>
                        <td className="py-4 text-slate-400">Nobody pinged creator</td>
                        <td className="py-4 text-rose-400 font-mono text-[11px]">WeTransfer expired</td>
                        <td className="py-4 text-rose-400">Commercial dispute</td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* Chaos Pain Callouts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-rose-500/20 bg-[#0B0608] divide-y md:divide-y-0 md:divide-x divide-rose-500/20">
                  <div className="p-5 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-sans font-semibold text-rose-200">14+ Hours Lost Weekly</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Chasing creators and updating spreadsheets.
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-sans font-semibold text-amber-200">28% Missed Deliverables</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Ghosted with no automated reminders.
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex items-start gap-3">
                    <X className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-sans font-semibold text-rose-200">Zero Proof Version History</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Paying blindly without verified drafts.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STATE B: COLLABO AUTONOMOUS COMMAND ENGINE ──────────────────── */}
            {activeView === 'command' && (
              <motion.div
                key="command-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl bg-[#0A0E17]/90 border border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden backdrop-blur-xl"
              >
                {/* Window Command Bar */}
                <div className="h-12 px-6 bg-[#080B11] border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    </div>
                    <span className="text-xs font-sans text-slate-300 font-medium">
                      Active Campaign Ledger
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-sans text-emerald-300">
                      <Bell className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold">2 New Proofs</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-sans text-slate-300 hover:text-white transition-colors cursor-pointer">
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export Monthly PDF</span>
                    </div>
                  </div>
                </div>

                {/* High Density Table */}
                <div className="p-5 sm:p-7 overflow-x-auto">
                  <table className="w-full border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-slate-400 text-left text-xs">
                        <th className="pb-3.5 font-medium">Creator Channel</th>
                        <th className="pb-3.5 font-medium">Deliverables</th>
                        <th className="pb-3.5 font-medium">Commercial</th>
                        <th className="pb-3.5 font-medium">Deadline</th>
                        <th className="pb-3.5 font-medium">Auto-Chaser</th>
                        <th className="pb-3.5 font-medium">Magic Proof</th>
                        <th className="pb-3.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      
                      {/* Row 1 */}
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <div className="font-mono font-semibold text-white">@rohan_vlogs</div>
                          <div className="text-[11px] text-slate-400">Instagram • 240K Reach</div>
                        </td>
                        <td className="py-4 text-slate-200">1x Reel + 2x Stories</td>
                        <td className="py-4 font-mono text-emerald-400 font-medium tabular-nums">₹15,000</td>
                        <td className="py-4 font-mono text-slate-300 tabular-nums">24 Oct 2026</td>
                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <Clock className="w-3 h-3" />
                            <span>48h WhatsApp Queued</span>
                          </span>
                        </td>
                        <td className="py-4 font-mono text-slate-400">
                          <span className="hover:text-white underline cursor-pointer">
                            /submit-proof/tok_rh98x1
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </td>
                      </tr>

                      {/* Row 2 */}
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <div className="font-mono font-semibold text-white">@priya_glow</div>
                          <div className="text-[11px] text-slate-400">YouTube Shorts • 580K Subs</div>
                        </td>
                        <td className="py-4 text-slate-200">1x YouTube Shorts</td>
                        <td className="py-4 font-mono text-emerald-400 font-medium tabular-nums">₹22,500</td>
                        <td className="py-4 font-mono text-slate-300 tabular-nums">02 Nov 2026</td>
                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.05] border border-white/[0.08] text-slate-300">
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Proof Submitted</span>
                          </span>
                        </td>
                        <td className="py-4 font-sans text-slate-400">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium">
                            Version 2 (Draft)
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-300 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            In Review
                          </span>
                        </td>
                      </tr>

                      {/* Row 3 */}
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4">
                          <div className="font-mono font-semibold text-white">@tech_kabir</div>
                          <div className="text-[11px] text-slate-400">Instagram Tech • 890K Reach</div>
                        </td>
                        <td className="py-4 text-slate-200">1x Reel + Bio Link</td>
                        <td className="py-4 font-mono text-emerald-400 font-medium tabular-nums">₹45,000</td>
                        <td className="py-4 font-mono text-slate-300 tabular-nums">15 Nov 2026</td>
                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <Clock className="w-3 h-3" />
                            <span>Trigger Armed</span>
                          </span>
                        </td>
                        <td className="py-4 font-mono text-slate-400">
                          <span className="hover:text-white underline cursor-pointer">
                            /submit-proof/tok_tk04k9
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Verified
                          </span>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* Collabo Command Telemetry Footer */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/[0.06] bg-[#070A10]/60 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                  <div className="p-5 text-center">
                    <div className="text-2xl font-mono font-medium text-emerald-400 tabular-nums">0</div>
                    <div className="text-xs font-sans text-slate-400 mt-1">Manual Cells Required</div>
                  </div>
                  <div className="p-5 text-center">
                    <div className="text-2xl font-mono font-medium text-emerald-400 tabular-nums">100%</div>
                    <div className="text-xs font-sans text-slate-400 mt-1">Automated WhatsApp Reminders</div>
                  </div>
                  <div className="p-5 text-center">
                    <div className="text-2xl font-mono font-medium text-emerald-400 tabular-nums">0.8s</div>
                    <div className="text-xs font-sans text-slate-400 mt-1">AI Extraction Speed</div>
                  </div>
                  <div className="p-5 text-center">
                    <div className="text-2xl font-sans font-medium text-emerald-400">Zero</div>
                    <div className="text-xs font-sans text-slate-400 mt-1">Creator App Installs</div>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
