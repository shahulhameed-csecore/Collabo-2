'use client';

import { motion } from 'framer-motion';
import { Upload, Bot, Database, Zap, Users, BarChart3, ArrowDown } from 'lucide-react';

export function SimplifiedWorkflow() {
  const steps = [
    { icon: <Upload className="w-5 h-5 text-white" />, label: "Upload Screenshot" },
    { icon: <Bot className="w-5 h-5 text-white" />, label: "AI Extraction" },
    { icon: <Database className="w-5 h-5 text-white" />, label: "Campaign Creation" },
    { icon: <Zap className="w-5 h-5 text-white" />, label: "WhatsApp Automation" },
    { icon: <Users className="w-5 h-5 text-white" />, label: "Creator Management" },
    { icon: <BarChart3 className="w-5 h-5 text-white" />, label: "Campaign Success" }
  ];

  return (
    <section className="py-24 relative bg-[#030712]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-[#94A3B8] text-lg">A simple, linear workflow.</p>
        </div>

        <div className="flex flex-col items-center gap-4 relative">
          
          {/* Vertical Line */}
          <div className="absolute top-4 bottom-4 w-px bg-[#1E293B] -z-10" />

          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1 }}
              className="w-full flex items-center justify-center relative"
            >
              <div className="bg-[#081428] border border-[#1E293B] rounded-full px-6 py-3 flex items-center gap-4 shadow-lg shadow-[#000000]/50 hover:border-[#00D4A5] hover:bg-[#00D4A5]/5 transition-all">
                <div className="w-8 h-8 rounded-full bg-[#00D4A5] flex items-center justify-center text-[#030712] shrink-0">
                  {step.icon}
                </div>
                <span className="font-bold text-white text-lg min-w-[200px] text-center md:text-left">{step.label}</span>
              </div>
            </motion.div>
          ))}
          
        </div>

      </div>
    </section>
  );
}
