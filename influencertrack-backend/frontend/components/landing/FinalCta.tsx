'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function FinalCta() {
  return (
    <section className="py-32 relative bg-[#030712] border-t border-[#1E293B] overflow-hidden">
      
      {/* Dashboard-esque subtle background lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-8 leading-tight"
        >
          Your next influencer campaign shouldn't live in a <span className="text-[#00D4A5]">spreadsheet.</span>
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-xl text-[#94A3B8] mb-12 max-w-2xl mx-auto"
        >
          Your brand has grown. Your workflow should too. Log in to the ultimate campaign dashboard today.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-[#00D4A5] text-[#030712] font-bold text-lg rounded-xl hover:bg-[#00FFC8] active:scale-95 transition-all shadow-[0_0_30px_rgba(0,212,165,0.2)]">
            Enter Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
