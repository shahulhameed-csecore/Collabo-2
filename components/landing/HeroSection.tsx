'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Bot, Sparkles, Smartphone, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 text-indigo-300 text-sm font-medium mb-8 backdrop-blur-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span>The Operating System for Influencer Campaigns</span>
        </motion.div>

        {/* Headlines */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight max-w-5xl mx-auto"
        >
          From WhatsApp Chaos to <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
            Campaign Clarity.
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Stop managing influencers in messy spreadsheets. Our AI turns your chat screenshots into organized campaigns, tracks deadlines, and automates follow-ups.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 font-bold rounded-full hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            Start Managing for Free <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 text-white font-medium rounded-full hover:bg-slate-700/50 transition-all backdrop-blur-sm border border-slate-700">
            See how it works
          </Link>
        </motion.div>

        {/* Interactive Extraction Pipeline Animation */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-[#020617] z-20 pointer-events-none h-full w-full bottom-0" style={{ top: '60%' }} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-6 bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-xl relative z-10 shadow-2xl">
            
            {/* Step 1: Chat */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 relative">
              <div className="flex items-center gap-3 mb-2 border-b border-slate-800 pb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-white">WhatsApp</div>
              </div>
              <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-2xl rounded-tl-sm p-3 text-sm text-slate-200">
                Hey! I can do the 2 Reels for $500. Can post by Friday.
              </div>
            </div>

            {/* Step 2: AI Processing */}
            <div className="hidden md:flex flex-col items-center justify-center gap-2 relative">
              <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/50 rounded-full flex items-center justify-center relative z-10">
                <Bot className="w-6 h-6 text-indigo-400 animate-pulse" />
              </div>
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/50 via-indigo-500/50 to-violet-500/50 -translate-y-1/2 -z-10" />
            </div>

            {/* Step 3: Structured Data */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-violet-500/5 pointer-events-none" />
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500 font-medium">DELIVERABLE</span>
                  <span className="text-sm text-white font-semibold">2x Reels</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500 font-medium">BUDGET</span>
                  <span className="text-sm text-emerald-400 font-semibold">$500</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">DEADLINE</span>
                  <span className="text-sm text-rose-400 font-semibold">This Friday</span>
                </div>
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
