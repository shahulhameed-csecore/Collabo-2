'use client';

import { motion } from 'framer-motion';
import { AlertCircle, CalendarX, FileSpreadsheet, MessageSquareWarning, RefreshCw, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';

const problems = [
  {
    icon: <CalendarX className="w-6 h-6 text-rose-400" />,
    title: "Missed Deadlines",
    desc: "Creators forget to post, and you forget to remind them. Money wasted."
  },
  {
    icon: <Wallet className="w-6 h-6 text-amber-400" />,
    title: "Forgotten Payments",
    desc: "Losing track of who was paid $50 vs $500, leading to awkward disputes."
  },
  {
    icon: <FileSpreadsheet className="w-6 h-6 text-indigo-400" />,
    title: "Spreadsheet Chaos",
    desc: "Manually copying DM text into 15 different columns across multiple Google Sheets."
  },
  {
    icon: <MessageSquareWarning className="w-6 h-6 text-emerald-400" />,
    title: "WhatsApp Confusion",
    desc: "Endless scrolling to find out what deliverables you actually agreed on."
  },
  {
    icon: <RefreshCw className="w-6 h-6 text-violet-400" />,
    title: "Manual Follow Ups",
    desc: "Wasting 10 hours a week just sending 'Hey, did you post yet?' messages."
  },
  {
    icon: <AlertCircle className="w-6 h-6 text-orange-400" />,
    title: "Zero Analytics",
    desc: "No idea if your influencer marketing is actually generating a positive ROI."
  }
];

export function ProblemSection() {
  return (
    <section className="py-24 relative overflow-hidden bg-[#020617]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4"
          >
            Managing Influencers is <span className="text-rose-400">Broken.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            You are spending more time managing logistics than actually growing your brand.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((prob, i) => (
            <ProblemCard key={i} prob={prob} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}

function ProblemCard({ prob, index }: { prob: any, index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      className="relative group bg-[#0F172A] border border-slate-800 rounded-3xl p-8 overflow-hidden hover:border-slate-700 transition-colors"
    >
      {/* Radial Hover Glow */}
      <div 
        className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle 200px at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.03), transparent)`
        }}
      />
      
      <div className="relative z-10">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-800 group-hover:scale-110 transition-transform">
          {prob.icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{prob.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{prob.desc}</p>
      </div>
    </motion.div>
  );
}
