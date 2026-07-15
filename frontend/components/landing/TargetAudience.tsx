'use client';

import { motion } from 'framer-motion';
import { ShoppingBag, Users, Zap, Briefcase, UserCircle2 } from 'lucide-react';

const audiences = [
  {
    icon: <ShoppingBag className="w-6 h-6 text-indigo-400" />,
    title: "D2C Brands",
    desc: "Scale your product seeding and micro-influencer campaigns without hiring a logistics team."
  },
  {
    icon: <Users className="w-6 h-6 text-emerald-400" />,
    title: "Marketing Agencies",
    desc: "Manage 10x more creators per campaign. Generate beautiful proof-of-work reports for your clients instantly."
  },
  {
    icon: <Zap className="w-6 h-6 text-violet-400" />,
    title: "Startup Founders",
    desc: "You don't have time to chase influencers. Let the AI and automated WhatsApp pings do it for you."
  },
  {
    icon: <Briefcase className="w-6 h-6 text-amber-400" />,
    title: "E-commerce Businesses",
    desc: "Tie your influencer deliverables directly to deadlines. Never pay for a post that wasn't published."
  },
  {
    icon: <UserCircle2 className="w-6 h-6 text-sky-400" />,
    title: "Creator Managers",
    desc: "Give your creators a frictionless experience via Magic Links. No passwords, no portals."
  }
];

export function TargetAudience() {
  return (
    <section className="py-24 relative bg-[#020617]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Who is Collabo for?
          </h2>
          <p className="text-slate-400 text-lg">Perfect for modern, founder-led teams.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-center">
          {audiences.map((aud, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0F172A] border border-slate-800 rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-300 shadow-lg hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)]"
            >
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-800">
                {aud.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{aud.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{aud.desc}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
