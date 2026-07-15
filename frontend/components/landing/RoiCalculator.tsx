'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export function RoiCalculator() {
  const [creators, setCreators] = useState(25);

  // Simple ROI estimation logic
  const hoursSaved = Math.round(creators * 0.6); // roughly 36 mins per creator saved
  const deadlinesManaged = creators;
  const automatedPings = creators * 2; // Assuming 2 pings per creator

  return (
    <section className="py-24 relative overflow-hidden bg-[#020617]">
      <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Calculate your ROI
          </h2>
          <p className="text-slate-400 text-lg">Stop paying yourself to do data entry.</p>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl">
          
          {/* Slider */}
          <div className="mb-12">
            <div className="flex justify-between items-end mb-4">
              <label className="text-slate-300 font-semibold">How many creators do you manage per month?</label>
              <span className="text-3xl font-bold text-indigo-400">{creators}</span>
            </div>
            
            <input 
              type="range" 
              min="5" 
              max="150" 
              value={creators}
              onChange={(e) => setCreators(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
              <span>5</span>
              <span>150+</span>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="text-4xl font-extrabold text-white mb-2">{hoursSaved}<span className="text-xl text-slate-500">h</span></div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Hours Saved</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="text-4xl font-extrabold text-emerald-400 mb-2">{deadlinesManaged}</div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Deadlines Tracked</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
              <div className="text-4xl font-extrabold text-violet-400 mb-2">{automatedPings}</div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Automated Pings</div>
            </div>
          </div>

          <motion.div 
            key={hoursSaved}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6"
          >
            <p className="text-lg text-indigo-200 font-medium">
              You could save approximately <strong className="text-white font-bold">{hoursSaved}+ hours</strong> every month. What is your time worth?
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
