'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

const steps = [
  { title: "Upload Screenshot", desc: "Drag and drop the messy negotiation from WhatsApp or Instagram DMs." },
  { title: "AI Extraction", desc: "Our Gemini-powered engine instantly finds the influencer name, deliverables, and budget." },
  { title: "Campaign Creation", desc: "A clean database row is created automatically. No manual data entry needed." },
  { title: "Automated Reminders", desc: "48 hours before the deadline, the creator gets a WhatsApp ping automatically." },
  { title: "Creator Proof Submission", desc: "They click a Magic Link and paste their live post URL. No account required." },
  { title: "Campaign Completed", desc: "The dashboard turns green. You see your ROI instantly." },
];

export function MagicMomentTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  return (
    <section ref={containerRef} className="py-32 relative bg-[#020617]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-24">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Magic Moment.</span>
          </h2>
        </div>

        <div className="flex flex-col md:flex-row gap-16 relative">
          
          {/* Left: Timeline Text */}
          <div className="md:w-1/2 space-y-12 relative z-10">
            {/* Progress Line */}
            <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-slate-800 -z-10" />
            <motion.div 
              className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-indigo-500 origin-top -z-10"
              style={{ scaleY: scrollYProgress }}
            />

            {steps.map((step, i) => (
              <TimelineItem key={i} step={step} index={i} progress={scrollYProgress} total={steps.length} />
            ))}
          </div>

          {/* Right: Sticky Visuals */}
          <div className="hidden md:block md:w-1/2">
            <div className="sticky top-1/3 w-full h-[400px] bg-[#0F172A] border border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center p-8 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 pointer-events-none" />
              
              {/* Dynamic UI Preview placeholder based on scroll position */}
              <div className="text-center relative z-10">
                <div className="w-20 h-20 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                  <SparklesIcon progress={scrollYProgress} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Workflow Automation in Progress</h3>
                <p className="text-slate-400 text-sm">Scroll down to see the magic happen.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function TimelineItem({ step, index, progress, total }: any) {
  // Calculate when this specific item should light up
  const start = index / total;
  const end = (index + 1) / total;
  
  const opacity = useTransform(progress, [start - 0.1, start, end], [0.3, 1, 1]);
  const scale = useTransform(progress, [start - 0.1, start], [0.8, 1]);
  const isActive = useTransform(progress, (p: number) => p >= start);

  return (
    <motion.div style={{ opacity }} className="relative flex gap-6 items-start">
      <motion.div 
        style={{ scale }}
        className="w-8 h-8 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
      >
        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full" />
      </motion.div>
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
        <p className="text-slate-400 leading-relaxed text-lg">{step.desc}</p>
      </div>
    </motion.div>
  );
}

function SparklesIcon({ progress }: { progress: any }) {
  const rotate = useTransform(progress, [0, 1], [0, 360]);
  return (
    <motion.svg style={{ rotate }} xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </motion.svg>
  );
}
