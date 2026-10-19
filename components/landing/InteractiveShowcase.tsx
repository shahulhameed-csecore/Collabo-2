'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Bot, Link as LinkIcon, BarChart3, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "One Clean View.",
    desc: "Every campaign, deliverable, and payment status in a single, sortable table. No more digging through tabs.",
    color: "from-indigo-500 to-violet-500"
  },
  {
    id: "ai",
    label: "AI Extraction",
    icon: Bot,
    title: "Zero Data Entry.",
    desc: "Forward a chat to our bot, and the AI automatically pulls the name, budget, and deadline into your database.",
    color: "from-violet-500 to-fuchsia-500"
  },
  {
    id: "magic-links",
    label: "Magic Links",
    icon: LinkIcon,
    title: "Frictionless Proof.",
    desc: "Creators hate creating accounts. Send them a secure Magic Link to upload their live post URL instantly.",
    color: "from-fuchsia-500 to-rose-500"
  },
  {
    id: "whatsapp",
    label: "WhatsApp Integration",
    icon: Smartphone,
    title: "Automated Reminders.",
    desc: "Set it and forget it. Collabo pings the creator on WhatsApp 48 hours before their deadline.",
    color: "from-emerald-400 to-teal-500"
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    title: "Real ROI Tracking.",
    desc: "Stop guessing. See exactly how much you're spending across platforms and measure your on-time delivery rates.",
    color: "from-blue-500 to-cyan-500"
  }
];

export function InteractiveShowcase() {
  const [activeTab, setActiveTab] = useState(features[0].id);

  const activeFeature = features.find(f => f.id === activeTab)!;

  return (
    <section className="py-32 relative bg-[#020617]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            Everything you need.
          </h2>
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
                  "relative px-4 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 transition-colors",
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute inset-0 bg-slate-800 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", isActive ? "text-indigo-400" : "")} />
                  {feature.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Showcase Content */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-[2rem] p-8 md:p-12 overflow-hidden relative min-h-[400px] flex items-center shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full grid md:grid-cols-2 gap-12 items-center relative z-10"
            >
              
              <div className="space-y-6">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${activeFeature.color} flex items-center justify-center shadow-lg`}>
                  <activeFeature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold text-white">{activeFeature.title}</h3>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                  {activeFeature.desc}
                </p>
              </div>

              {/* Abstract Visual Representation */}
              <div className="h-64 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${activeFeature.color} opacity-10`} />
                <activeFeature.icon className={`w-24 h-24 text-transparent bg-clip-text bg-gradient-to-br ${activeFeature.color} opacity-50`} />
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
