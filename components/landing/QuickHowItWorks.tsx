'use client';

import { motion } from 'framer-motion';
import { UploadCloud, Bot, LayoutDashboard, ArrowRight } from 'lucide-react';

export function QuickHowItWorks() {
  const steps = [
    {
      icon: <UploadCloud className="w-6 h-6 text-indigo-400" />,
      title: "1. Upload Screenshot",
      desc: "Drop a screenshot of your DM negotiation or forward a WhatsApp chat to our bot."
    },
    {
      icon: <Bot className="w-6 h-6 text-violet-400" />,
      title: "2. AI Extraction",
      desc: "Collabo AI reads the unstructured text and extracts deliverables, budgets, and deadlines instantly."
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-emerald-400" />,
      title: "3. Manage Everything",
      desc: "Your campaign is active. We auto-remind the creator and collect their proof of work via Magic Links."
    }
  ];

  return (
    <section className="py-24 relative bg-slate-900/50 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-2xl font-bold text-slate-300 uppercase tracking-widest text-sm mb-2">How it works in 60 Seconds</h2>
          <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Complex workflows, reduced to <span className="text-indigo-400">three steps.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting Line for Desktop */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-slate-700 to-transparent z-0" />

          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="relative z-10 flex flex-col items-center text-center group"
            >
              <div className="w-24 h-24 rounded-full bg-[#0F172A] border border-slate-700 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-slate-400 text-sm max-w-[280px] leading-relaxed">{step.desc}</p>
              
              {i !== 2 && (
                <div className="md:hidden mt-8 text-slate-700">
                  <ArrowRight className="w-6 h-6 rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
