'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MessageSquare, Bot, Database, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function HeroLiveDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev < 5 ? prev + 1 : 0));
    }, 2500); // cycle every 2.5s
    return () => clearInterval(timer);
  }, []);

  const progressPercentage = step === 0 ? 10 : step === 1 ? 40 : step === 2 ? 60 : step === 3 ? 80 : step === 4 ? 90 : 100;

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-[#030712]">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Left: Copy & CTA */}
          <div className="text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#081428] border border-[#1E293B] text-[#00D4A5] text-xs font-bold uppercase tracking-wider mb-8"
            >
              <Zap className="w-4 h-4" />
              <span>Collabo OS</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 leading-[1.1]"
            >
              From WhatsApp Chaos to <br />
              <span className="text-[#00D4A5]">Campaign Clarity.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-[#94A3B8] max-w-xl mb-10 leading-relaxed"
            >
              Stop managing creators manually. Forward your negotiation chat, and our AI instantly builds your campaign database, tracks deadlines, and automates WhatsApp follow-ups.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-[#00D4A5] text-[#030712] font-bold rounded-lg hover:bg-[#00FFC8] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,212,165,0.2)]">
                Start Managing for Free <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>

          {/* Right: Live Demo Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative w-full max-w-lg mx-auto lg:mx-0"
          >
            {/* The "Dashboard Component" Container */}
            <div className="bg-[#071126] border border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
              
              {/* Header */}
              <div className="bg-[#081428] border-b border-[#1E293B] px-4 py-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FF4F81]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFC933]" />
                  <div className="w-3 h-3 rounded-full bg-[#00D4A5]" />
                </div>
                <div className="text-xs font-mono text-[#94A3B8]">AI_EXTRACTION_PROCESS</div>
              </div>

              {/* Progress Bar */}
              <div className="h-1 w-full bg-[#030712]">
                <div 
                  className="h-full bg-[#00D4A5] transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Body */}
              <div className="p-6 h-[320px] relative flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  
                  {step === 0 && (
                    <DemoState key="0" icon={MessageSquare} text="Uploading WhatsApp Screenshot..." pct="10%" color="text-white" />
                  )}
                  {step === 1 && (
                    <DemoState key="1" icon={Bot} text="Analyzing Influencer Chat..." pct="40%" color="text-[#00D4A5]" />
                  )}
                  {step === 2 && (
                    <DemoState key="2" icon={Bot} text="Extracting Deliverables & Budget..." pct="60%" color="text-[#00D4A5]" />
                  )}
                  {step === 3 && (
                    <DemoState key="3" icon={Database} text="Creating Campaign Record..." pct="80%" color="text-white" />
                  )}
                  {step === 4 && (
                    <DemoState key="4" icon={Zap} text="Automated Deadline Linked..." pct="90%" color="text-[#FFC933]" />
                  )}
                  
                  {step === 5 && (
                    <motion.div 
                      key="5"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="w-full bg-[#081428] border border-[#1E293B] rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-xs text-[#94A3B8] font-bold uppercase mb-1">Campaign Created</div>
                          <div className="text-lg font-bold text-white">Sarah Jenkins • 2x IG Reels</div>
                        </div>
                        <div className="px-2 py-1 bg-[#00D4A5]/10 border border-[#00D4A5]/20 rounded text-[#00D4A5] text-xs font-bold">
                          ACTIVE
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#94A3B8]">Budget</span>
                          <span className="text-white font-mono">$500.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#94A3B8]">Deadline</span>
                          <span className="text-[#FFC933] font-mono">Friday, 5:00 PM</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#94A3B8]">Reminders</span>
                          <span className="text-[#00D4A5] font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Scheduled
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

function DemoState({ icon: Icon, text, pct, color }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center gap-4 text-center"
    >
      <div className={cn("w-12 h-12 rounded-lg bg-[#081428] border border-[#1E293B] flex items-center justify-center", color)}>
        <Icon className="w-6 h-6 animate-pulse" />
      </div>
      <div className="font-mono text-sm text-[#94A3B8]">
        <span className={cn("font-bold mr-2", color)}>[{pct}]</span>
        {text}
      </div>
    </motion.div>
  );
}
