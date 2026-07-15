'use client';

import { motion } from 'framer-motion';
import { Clock, IndianRupee, Bot, CheckCircle, RefreshCw, Link as LinkIcon } from 'lucide-react';

export function BentoBenefits() {
  return (
    <section className="py-24 relative bg-[#030712]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Why people love Collabo
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
          
          {/* Feature 1 (Large) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 md:row-span-2 bg-[#081428] border border-[#1E293B] rounded-2xl p-8 flex flex-col justify-between group hover:border-[#00D4A5] transition-colors relative overflow-hidden"
          >
            <div className="mb-8 relative z-10">
              <div className="w-12 h-12 rounded-lg bg-[#00D4A5]/10 border border-[#00D4A5]/20 flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-[#00D4A5]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Saves Hours Every Week</h3>
              <p className="text-[#94A3B8] leading-relaxed max-w-md">
                Stop chasing influencers. We automate the entire follow-up process via WhatsApp, so you can focus on building your brand.
              </p>
            </div>
          </motion.div>

          {/* Feature 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-[#081428] border border-[#1E293B] rounded-2xl p-8 flex flex-col justify-center group hover:border-[#00D4A5] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1E293B] flex items-center justify-center mb-4">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Saves Money</h3>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Never pay for a deliverable you didn't receive. Full visibility into who posted.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-[#081428] border border-[#1E293B] rounded-2xl p-8 flex flex-col justify-center group hover:border-[#00D4A5] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1E293B] flex items-center justify-center mb-4">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Automates Follow Ups</h3>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Automated WhatsApp reminders ensure creators never miss a deadline.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="bg-[#081428] border border-[#1E293B] rounded-2xl p-8 flex flex-col justify-center group hover:border-[#00D4A5] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1E293B] flex items-center justify-center mb-4">
              <LinkIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Creator Friendly</h3>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Creators upload proof via secure Magic Links. No passwords required.
            </p>
          </motion.div>

          {/* Feature 5 (Wide) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="md:col-span-2 bg-[#081428] border border-[#1E293B] rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 group hover:border-[#00D4A5] transition-colors relative overflow-hidden"
          >
            <div className="flex-1 relative z-10">
              <div className="w-10 h-10 rounded-lg bg-[#1E293B] flex items-center justify-center mb-4">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Organizes Everything</h3>
              <p className="text-[#94A3B8] leading-relaxed">
                Every campaign, deadline, payment, and deliverable is centralized in one beautiful dashboard. Say goodbye to spreadsheet chaos forever.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
