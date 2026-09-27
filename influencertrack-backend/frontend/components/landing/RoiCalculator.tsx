'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export function RoiCalculator() {
  const [creators, setCreators] = useState(25);

  const hoursSaved = Math.round(creators * 0.6); 
  const deadlinesManaged = creators;
  const automatedPings = creators * 2;

  return (
    <section className="py-24 relative bg-[#030712]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Calculate your ROI
          </h2>
        </div>

        <div className="bg-[#071126] border border-[#1E293B] rounded-xl p-8 md:p-12 shadow-2xl">
          
          <div className="mb-12 bg-[#081428] border border-[#1E293B] p-6 rounded-lg">
            <div className="flex justify-between items-end mb-6">
              <label className="text-white font-bold">How many creators do you manage per month?</label>
              <span className="text-4xl font-mono text-[#00D4A5]">{creators}</span>
            </div>
            
            <input 
              type="range" 
              min="5" 
              max="150" 
              value={creators}
              onChange={(e) => setCreators(parseInt(e.target.value))}
              className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#00D4A5]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#081428] border border-[#1E293B] rounded-lg p-6">
              <div className="text-3xl font-mono text-white mb-1">{hoursSaved}</div>
              <div className="text-xs font-bold text-[#94A3B8] uppercase">Est. Hours Saved</div>
            </div>
            <div className="bg-[#081428] border border-[#1E293B] rounded-lg p-6">
              <div className="text-3xl font-mono text-[#00FFC8] mb-1">{deadlinesManaged}</div>
              <div className="text-xs font-bold text-[#94A3B8] uppercase">Deadlines Managed</div>
            </div>
            <div className="bg-[#081428] border border-[#1E293B] rounded-lg p-6">
              <div className="text-3xl font-mono text-white mb-1">{automatedPings}</div>
              <div className="text-xs font-bold text-[#94A3B8] uppercase">Automated Pings</div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
