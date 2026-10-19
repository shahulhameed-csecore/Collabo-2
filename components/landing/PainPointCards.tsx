'use client';

import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, XCircle, RefreshCw, FileSpreadsheet, MessageSquareWarning } from 'lucide-react';

const problems = [
  {
    type: "danger",
    icon: <XCircle className="w-5 h-5 text-[#FF4F81]" />,
    title: "Missed Deadline",
    desc: "Creator ghosted you on launch day."
  },
  {
    type: "warning",
    icon: <AlertTriangle className="w-5 h-5 text-[#FFC933]" />,
    title: "Forgotten Payment",
    desc: "Creator is angry about unpaid deliverable."
  },
  {
    type: "neutral",
    icon: <FileSpreadsheet className="w-5 h-5 text-[#94A3B8]" />,
    title: "Spreadsheet Chaos",
    desc: "Data scattered across 15 different tabs."
  },
  {
    type: "neutral",
    icon: <MessageSquareWarning className="w-5 h-5 text-[#94A3B8]" />,
    title: "WhatsApp Confusion",
    desc: "Endless scrolling to find agreed terms."
  },
  {
    type: "warning",
    icon: <RefreshCw className="w-5 h-5 text-[#FFC933]" />,
    title: "Manual Follow Ups",
    desc: "Wasted 4 hours chasing creators today."
  },
  {
    type: "danger",
    icon: <AlertCircle className="w-5 h-5 text-[#FF4F81]" />,
    title: "Campaign Tracking Error",
    desc: "Unable to calculate ROI. Data missing."
  }
];

export function PainPointCards() {
  return (
    <section className="py-24 relative overflow-hidden bg-[#071126] border-y border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Managing influencers is a logistics nightmare.
          </h2>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            These notifications shouldn't be part of your daily workflow.
          </p>
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
  
  const bgColors: any = {
    danger: "bg-[#FF4F81]/10 border-[#FF4F81]/20",
    warning: "bg-[#FFC933]/10 border-[#FFC933]/20",
    neutral: "bg-[#1E293B] border-[#1E293B]"
  };

  const textColors: any = {
    danger: "text-[#FF4F81]",
    warning: "text-[#FFC933]",
    neutral: "text-[#94A3B8]"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className={`relative bg-[#081428] border ${prob.type === 'neutral' ? 'border-[#1E293B]' : bgColors[prob.type].split(' ')[1]} rounded-xl p-6 overflow-hidden flex items-start gap-4 transition-transform hover:-translate-y-1 shadow-lg`}
    >
      <div className={`mt-1 p-2 rounded-lg ${bgColors[prob.type]} border`}>
        {prob.icon}
      </div>
      <div>
        <h3 className={`font-bold mb-1 ${textColors[prob.type]}`}>{prob.title}</h3>
        <p className="text-[#94A3B8] text-sm leading-relaxed">{prob.desc}</p>
      </div>
    </motion.div>
  );
}
