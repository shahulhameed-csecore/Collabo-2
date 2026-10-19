'use client';

import { motion } from 'framer-motion';
import { Clock, IndianRupee, Bot, CheckCircle, RefreshCw, Link as LinkIcon } from 'lucide-react';

export function BentoFeatures() {
  return (
    <section className="py-24 relative bg-[#020617]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Why growing brands love Collabo
          </h2>
          <p className="text-slate-400 text-lg">Designed to eliminate operational friction.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
          
          {/* Feature 1 (Large) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 md:row-span-2 bg-[#0F172A] border border-slate-800 rounded-3xl p-8 flex flex-col justify-between group hover:border-indigo-500/30 transition-colors relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="mb-8 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Saves 15+ Hours Every Week</h3>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Stop chasing influencers. We automate the entire follow-up process via WhatsApp, so you can focus on building your brand instead of playing secretary.
              </p>
            </div>
            {/* Abstract UI representation */}
            <div className="relative h-48 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4">
              <div className="space-y-3">
                <div className="h-8 bg-slate-800/50 rounded-lg w-3/4 animate-pulse" />
                <div className="h-8 bg-slate-800/50 rounded-lg w-1/2 animate-pulse" />
                <div className="h-8 bg-indigo-500/20 rounded-lg w-5/6 border border-indigo-500/30 flex items-center px-3 gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <div className="h-2 bg-indigo-400/50 rounded w-24" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-[#0F172A] border border-slate-800 rounded-3xl p-8 flex flex-col justify-center group hover:border-emerald-500/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <IndianRupee className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Saves Money</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Never pay for a deliverable you didn't receive. Full visibility into who posted and who owes you.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-[#0F172A] border border-slate-800 rounded-3xl p-8 flex flex-col justify-center group hover:border-violet-500/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
              <Bot className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">AI Powered</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              No manual data entry. Forward a chat to our bot, and the AI handles the entire database creation.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="bg-[#0F172A] border border-slate-800 rounded-3xl p-8 flex flex-col justify-center group hover:border-amber-500/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
              <LinkIcon className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Creator Friendly</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Creators upload proof via secure Magic Links. No passwords, no portals, no friction.
            </p>
          </motion.div>

          {/* Feature 5 (Wide) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="md:col-span-2 bg-[#0F172A] border border-slate-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 group hover:border-sky-500/30 transition-colors relative overflow-hidden"
          >
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex-1 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-6">
                <CheckCircle className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">100% Organized</h3>
              <p className="text-slate-400 leading-relaxed">
                Every campaign, deadline, payment, and deliverable is centralized in one beautiful dashboard. Say goodbye to spreadsheet chaos forever.
              </p>
            </div>
            
            <div className="hidden md:flex flex-1 items-center justify-center relative z-10">
               {/* Abstract checkmark graphic */}
               <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
                 <div className="absolute inset-[-4px] rounded-full border-4 border-sky-400 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
                 <CheckCircle className="w-12 h-12 text-sky-400" />
               </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
