import { Sparkles } from 'lucide-react';

export function Field({
  label, icon: Icon, required, highlight, children,
}: {
  label: string;
  icon: React.ElementType;
  required?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`flex items-center gap-1.5 text-xs font-bold mb-2 tracking-wide ${highlight ? 'text-amber-400' : 'text-slate-400'}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
        {required && <span className="text-rose-400 font-bold">*</span>}
        {highlight && <span className="text-amber-400/60 font-normal ml-1">- please fill</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls = (highlight = false) =>
  `w-full bg-slate-800/50 border text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm
   focus:outline-none focus:ring-1 transition-all resize-none
   ${highlight
     ? 'border-amber-500/40 focus:border-amber-500/60 focus:ring-amber-500/15'
     : 'border-slate-700/50 focus:border-emerald-500/50 focus:ring-emerald-500/15'}`;

import { useState, useEffect } from 'react';

export function AiThinkingAnimation() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6 animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-spin" style={{ animationDuration: '3s' }} />
        <div className="relative p-5 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 rounded-full border border-emerald-500/25">
          <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-base mb-1">Analyzing your file with AI...</p>
        <p className="text-slate-500 text-sm h-10">
          {elapsed < 5 
            ? "Extracting influencer details, deliverables, deadline & payment..."
            : elapsed < 15
            ? "This usually takes 5-15 seconds..."
            : "Still analyzing your screenshot. Large files may take longer."}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
