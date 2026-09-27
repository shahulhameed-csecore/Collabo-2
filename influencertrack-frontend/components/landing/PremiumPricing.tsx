'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Zap } from 'lucide-react';
import Link from 'next/link';

export function PremiumPricing() {
  const features = [
    "Unlimited Campaigns",
    "AI Extraction",
    "Creator Management",
    "WhatsApp Automation",
    "Magic Links",
    "Analytics",
    "Payment Tracking"
  ];

  return (
    <section className="py-24 relative bg-[#030712]" id="pricing">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Simple Pricing.
          </h2>
          <p className="text-[#94A3B8] text-lg">Upgrade your workflow today.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[#081428] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto flex flex-col md:flex-row"
        >
          
          {/* Left Panel */}
          <div className="p-8 md:p-10 flex-1 border-b md:border-b-0 md:border-r border-[#1E293B]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white uppercase tracking-wider">PRO</h3>
              <div className="px-2 py-1 bg-[#00D4A5]/10 border border-[#00D4A5]/20 text-[#00D4A5] text-xs font-bold rounded flex items-center gap-1">
                <Zap className="w-3 h-3" /> Most Popular
              </div>
            </div>
            
            <div className="mb-6">
              <span className="text-5xl font-mono font-bold text-white">₹299</span>
              <span className="text-[#94A3B8] font-mono"> / month</span>
            </div>

            <p className="text-[#94A3B8] text-sm mb-8 leading-relaxed">
              Everything you need to automate your influencer logistics and stop missing deadlines.
            </p>

            <Link href="/signup" className="w-full block text-center py-3 bg-[#00D4A5] text-[#030712] font-bold rounded-lg hover:bg-[#00FFC8] active:scale-95 transition-all shadow-[0_0_15px_rgba(0,212,165,0.2)]">
              Start Free Trial
            </Link>
            <p className="text-center text-xs text-[#94A3B8] mt-3">Cancel anytime. No hidden fees.</p>
          </div>

          {/* Right Panel (Features) */}
          <div className="p-8 md:p-10 bg-[#071126] flex-1">
            <h4 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Included in Pro</h4>
            <ul className="space-y-4">
              {features.map((feat, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00D4A5] shrink-0" />
                  <span className="text-[#94A3B8] text-sm font-medium">{feat}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8 pt-6 border-t border-[#1E293B]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00D4A5] animate-pulse" />
                <span className="text-[#00D4A5] text-xs font-bold uppercase">Saves ~5+ Hours / Week</span>
              </div>
            </div>
          </div>

        </motion.div>

      </div>
    </section>
  );
}
