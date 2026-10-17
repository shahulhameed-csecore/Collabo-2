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
    answer: "Collabo connects directly to Gemini 3.5 Flash via our WhatsApp bot (+91 63747 71074). When you forward a voice note (in English, Hindi, or conversational Hinglish), an audio transcription model converts the speech to text, while our structured JSON extraction engine isolates creator handle, deliverable counts, agreed commercial (₹), and deadline in under 0.8 seconds."
  },
  {
    index: "02",
    question: "Do creators have to install an app or create an account to upload proof?",
    answer: "Never. Collabo is built on a zero-friction philosophy. For every campaign, the system generates an encrypted tokenized Magic Link (e.g. /submit-proof/tok_...). Creators tap the link directly from WhatsApp on their mobile browser and can drop raw MP4 video files, image screenshots, or live URLs without passwords."
  },
  {
    index: "03",
    question: "How do the automated 48-hour WhatsApp deadline chasers work?",
    answer: "Our background scheduler checks all pending campaign deadlines multiple times daily. Exactly 48 hours prior to an agreed delivery time, Collabo's bot automatically messages the creator with a friendly, professional reminder containing their unique magic upload link. If a deliverable becomes overdue, you receive an instant alert in your dashboard notification center."
  },
  {
    index: "04",
    question: "What is included in the 14-day free trial and what happens when it ends?",
    answer: "The 14-day trial gives you unrestricted access to all Collabo Pro features: unlimited campaigns, unlimited Gemini AI WhatsApp extractions, automated chasers, and affiliate click tracking. No credit card is required to sign up. At the end of 14 days, you can choose to continue on Collabo Pro for ₹300/month or downgrade to Starter for ₹0 forever."
  },
  {
    index: "05",
    question: "How does affiliate shortlink tracking and live Cost-Per-Click (CPC) calculation work?",
    answer: "For every creator deliverable, Collabo provides a fast, branded tracking shortlink (e.g. mycollabo.online/t/handle). When followers click the link, our edge redirect logs the click without adding latency, and your dashboard calculates live CPC by dividing your agreed creator commercial fee by verified unique click volume."
  },
  {
    index: "06",
    question: "Is our brand commercial data and creator negotiation history confidential?",
    answer: "Yes, completely. Your campaign commercials, creator rates, and internal notes are strictly isolated to your brand organization with Row-Level Security (RLS) on PostgreSQL. Your WhatsApp negotiation data is processed solely for metadata extraction and is never used to train public language models."
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
