'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function PricingSection() {
  return (
    <section className="py-24 relative bg-[#0F172A] border-y border-slate-800" id="pricing">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Pricing that scales with you.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Stop paying thousands for bloated discovery platforms. Pay only for the operations you need.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 max-w-5xl mx-auto justify-center">
          
          {/* Free Tier */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex-1 bg-[#111827] border border-slate-800 rounded-[2rem] p-8 md:p-10 flex flex-col hover:border-slate-700 transition-colors"
          >
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Free Tier</h3>
              <p className="text-slate-400 text-sm">Perfect for trying out the magic of AI extraction.</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-white">₹0</span>
              <span className="text-slate-500"> / forever</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {["Up to 5 campaigns per month", "AI Data Extraction", "Basic Dashboard", "Creator Magic Links"].map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="font-medium text-sm">{feat}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-center transition-colors">
              Get Started for Free
            </Link>
          </motion.div>

          {/* Pro Tier */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex-1 bg-gradient-to-b from-indigo-900/40 to-[#111827] border border-indigo-500/50 rounded-[2rem] p-8 md:p-10 flex flex-col relative shadow-[0_0_50px_rgba(99,102,241,0.15)] overflow-hidden"
          >
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-bl-2xl">
              Most Popular
            </div>
            
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Pro <Sparkles className="w-5 h-5 text-indigo-400" />
              </h3>
              <p className="text-indigo-200/70 text-sm">Everything you need to run high-volume seeding at scale.</p>
            </div>
            <div className="mb-2">
              <span className="text-5xl font-extrabold text-white">₹299</span>
              <span className="text-slate-500"> / month</span>
            </div>
            
            {/* ROI Highlight */}
            <div className="mb-8 inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400 text-xs font-bold uppercase tracking-wider">
              Saves ~15+ Hours/Week
            </div>

            <ul className="space-y-4 mb-10 flex-1">
              {["Unlimited campaigns", "WhatsApp Bot Integration", "Automated WhatsApp Reminders", "Advanced Analytics & ROI", "Priority Email Support"].map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="font-medium text-sm">{feat}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="w-full py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-center transition-colors shadow-lg shadow-indigo-500/25 active:scale-95">
              Start 7-Day Free Trial
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
