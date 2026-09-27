'use client';

import { motion } from 'framer-motion';
import { XCircle, CheckCircle2 } from 'lucide-react';

export function BeforeAfter() {
  const befores = [
    "Google Sheets",
    "WhatsApp Messages",
    "Missed Deadlines",
    "Manual Follow Ups",
    "Payment Confusion"
  ];

  const afters = [
    "AI Extraction",
    "One Clean Dashboard",
    "Automated Reminders",
    "Creator Management",
    "Payment Tracking"
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-[#0F172A] border-y border-slate-800">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Before vs After Collabo
          </h2>
          <p className="text-slate-400 text-lg">Stop relying on outdated workflows.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          
          {/* Before */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-300">Without Collabo</h3>
            </div>
            
            <ul className="space-y-4">
              {befores.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-400">
                  <XCircle className="w-4 h-4 text-rose-500/50 shrink-0" />
                  <span className="font-medium line-through decoration-rose-500/30">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* VS Divider (Desktop) */}
          <div className="hidden md:flex flex-col items-center justify-center -mx-4 z-10">
            <div className="w-12 h-12 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 font-bold shadow-xl">
              VS
            </div>
          </div>

          {/* After */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 bg-gradient-to-b from-indigo-900/20 to-slate-900/50 border border-indigo-500/30 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">With Collabo</h3>
            </div>
            
            <ul className="space-y-4 relative z-10">
              {afters.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-indigo-100">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
