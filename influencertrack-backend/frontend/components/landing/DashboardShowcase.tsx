'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, CreditCard, Bot, BarChart3, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  { id: "campaign", label: "Campaign Card", icon: LayoutDashboard },
  { id: "creator", label: "Creator Card", icon: Users },
  { id: "payment", label: "Payment Tracking", icon: CreditCard },
  { id: "ai", label: "AI Extraction", icon: Bot },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "whatsapp", label: "WhatsApp Reminder", icon: Smartphone }
];

export function DashboardShowcase() {
  const [activeTab, setActiveTab] = useState(features[0].id);

  return (
    <section className="py-32 relative bg-[#071126] border-y border-[#1E293B]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            The Dashboard Experience
          </h2>
          <p className="text-[#94A3B8] text-lg">Interactive components straight from the app.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeTab === feature.id;
            
            return (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={cn(
                  "relative px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors border",
                  isActive 
                    ? "bg-[#081428] border-[#00D4A5] text-[#00D4A5]" 
                    : "bg-transparent border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-[#00D4A5]" : "")} />
                {feature.label}
              </button>
            );
          })}
        </div>

        {/* Interactive Dashboard UI Preview Container */}
        <div className="bg-[#030712] border border-[#1E293B] rounded-xl p-8 md:p-12 min-h-[400px] flex items-center justify-center shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {activeTab === 'campaign' && (
              <motion.div key="campaign" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md bg-[#081428] border border-[#1E293B] rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">Summer Sale Launch</h3>
                  <span className="px-2 py-1 bg-[#00D4A5]/10 text-[#00D4A5] border border-[#00D4A5]/20 text-xs font-bold rounded">IN PROGRESS</span>
                </div>
                <div className="space-y-3 border-t border-[#1E293B] pt-4">
                  <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Creators</span><span className="text-white">12 Active</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Budget Spent</span><span className="text-white font-mono">$4,200</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#94A3B8]">Deadline</span><span className="text-[#FFC933]">Aug 15th</span></div>
                </div>
              </motion.div>
            )}

            {activeTab === 'creator' && (
              <motion.div key="creator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md bg-[#081428] border border-[#1E293B] rounded-lg p-6 flex items-center gap-4">
                <div className="w-16 h-16 bg-[#1E293B] rounded-full" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Alex Fitness</h3>
                  <p className="text-sm text-[#94A3B8]">@alex_fit_official</p>
                  <div className="mt-2 text-xs text-[#00D4A5] font-mono">1/2 Deliverables Completed</div>
                </div>
              </motion.div>
            )}

            {/* Default fallback for other tabs to keep demo simple */}
            {['payment', 'ai', 'analytics', 'whatsapp'].includes(activeTab) && (
              <motion.div key="generic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                <div className="w-16 h-16 bg-[#1E293B] rounded-lg flex items-center justify-center mx-auto mb-4 border border-[#334155]">
                  <Bot className="w-8 h-8 text-[#94A3B8]" />
                </div>
                <p className="text-[#94A3B8] font-mono text-sm">UI Component Loading...</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
