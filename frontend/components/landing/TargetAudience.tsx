'use client';

import { motion } from 'framer-motion';
import { ShoppingBag, Users, Zap, Briefcase, UserCircle2 } from 'lucide-react';

const audiences = [
  { title: "D2C Brands", icon: ShoppingBag },
  { title: "Marketing Agencies", icon: Users },
  { title: "Startup Founders", icon: Zap },
  { title: "Creator Managers", icon: UserCircle2 },
  { title: "E-Commerce", icon: Briefcase }
];

export function TargetAudience() {
  return (
    <section className="py-24 relative bg-[#071126] border-y border-[#1E293B]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <p className="text-[#94A3B8] font-mono text-sm uppercase tracking-widest mb-4">Who is Collabo for?</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Built for modern logistics.
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {audiences.map((aud, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#081428] border border-[#1E293B] rounded-lg px-6 py-4 flex items-center gap-3 hover:border-[#00D4A5] transition-colors"
            >
              <aud.icon className="w-5 h-5 text-[#00D4A5]" />
              <span className="font-bold text-white">{aud.title}</span>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
