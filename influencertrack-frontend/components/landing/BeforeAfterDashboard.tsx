'use client';

import { motion } from 'framer-motion';
import { XCircle, CheckCircle2 } from 'lucide-react';

export function BeforeAfterDashboard() {
  const befores = [
    "WhatsApp",
    "Google Sheets",
    "Manual Follow Ups",
    "Payment Confusion",
    "Missed Deadlines"
  ];

  const afters = [
    "AI Extraction",
    "Campaign Dashboard",
    "Automated Reminders",
    "Creator Management",
    "Payment Tracking"
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-[#071126] border-y border-[#1E293B]">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Before vs After Collabo
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          
          {/* Before */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 bg-[#030712] border border-[#1E293B] rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#FF4F81]/10 flex items-center justify-center border border-[#FF4F81]/20">
                <XCircle className="w-5 h-5 text-[#FF4F81]" />
              </div>
              <h3 className="text-2xl font-bold text-white">Before Collabo</h3>
            </div>
            
            <ul className="space-y-4">
              {befores.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[#94A3B8]">
                  <XCircle className="w-4 h-4 text-[#FF4F81]/50 shrink-0" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* VS Divider (Desktop) */}
          <div className="hidden md:flex flex-col items-center justify-center -mx-4 z-10">
            <div className="w-12 h-12 bg-[#081428] rounded-full border border-[#1E293B] flex items-center justify-center text-[#94A3B8] font-bold shadow-xl">
              VS
            </div>
          </div>

          {/* After */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 bg-[#081428] border border-[#00D4A5]/30 rounded-2xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(0,212,165,0.05)]"
          >
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-[#00D4A5]/10 flex items-center justify-center border border-[#00D4A5]/30">
                <CheckCircle2 className="w-5 h-5 text-[#00D4A5]" />
              </div>
              <h3 className="text-2xl font-bold text-white">After Collabo</h3>
            </div>
            
            <ul className="space-y-4 relative z-10">
              {afters.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-white">
                  <CheckCircle2 className="w-4 h-4 text-[#00D4A5] shrink-0" />
                  <span className="font-bold">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
