'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionEyebrow } from './ArchitecturalGrid';

interface FaqItemData {
  index: string;
  question: string;
  answer: string;
}

const FAQS: FaqItemData[] = [
  {
    index: "01",
    question: "How does the WhatsApp AI extraction handle Hinglish voice notes and messy DM screenshots?",
    answer: "Forward voice notes, chats, or screenshots to our WhatsApp bot. Collabo AI extracts creator handles, deliverables, rates, and deadlines in seconds."
  },
  {
    index: "02",
    question: "Do creators have to install an app or create an account to upload proof?",
    answer: "Never. Creators open a secure magic link in their mobile browser to upload drafts and screenshots—no account, app, or login needed."
  },
  {
    index: "03",
    question: "How do the automated 48-hour WhatsApp deadline chasers work?",
    answer: "Our bot automatically sends creators a friendly WhatsApp reminder 48 hours before their deadline, complete with their proof upload link."
  },
  {
    index: "04",
    question: "What is included in the 14-day free trial and what happens when it ends?",
    answer: "You get full access to all Pro features with zero commitment. After 14 days, continue for ₹300/month or use Starter free forever."
  },
  {
    index: "05",
    question: "How does affiliate shortlink tracking and live Cost-Per-Click (CPC) calculation work?",
    answer: "Collabo creates unique shortlinks for each creator, tracks clicks live, and automatically calculates your real-time cost-per-click."
  },
  {
    index: "06",
    question: "Is our brand commercial data and creator negotiation history confidential?",
    answer: "Yes, completely. Your creator rates, briefs, and campaigns are private to your workspace and never used to train public AI models."
  }
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative py-28 lg:py-36 bg-[#05070B] overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Eyebrow */}
        <SectionEyebrow
          badge="Knowledge Base"
          title="Frequently Answered Questions."
          description="Everything you need to know about the zero-entry pipeline, WhatsApp bot automation, and creator proof workflows."
        />

        {/* Accordion List with Hairline Dividers */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={faq.index} className="py-6 sm:py-7 transition-colors">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-start justify-between text-left gap-4 focus:outline-none group"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start gap-4">
                    <span className="font-mono text-xs text-slate-400 pt-1 select-none">
                      {faq.index}
                    </span>
                    <span className="text-base sm:text-lg font-medium font-sans text-slate-200 group-hover:text-white transition-colors">
                      {faq.question}
                    </span>
                  </div>
                  
                  <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 group-hover:border-white/[0.14] transition-colors">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-slate-400 transition-transform duration-200",
                        isOpen && "rotate-180 text-emerald-400"
                      )}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 pl-8 sm:pl-9 pr-6 text-sm text-slate-400 font-sans font-normal leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
