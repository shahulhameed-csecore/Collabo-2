'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  { q: "Is my data secure?", a: "Yes. We use industry-standard encryption. Your WhatsApp data is only used for extraction and is never shared." },
  { q: "How does AI extraction work?", a: "Forward a WhatsApp chat or upload a screenshot. Our AI reads the text, identifies the deliverables and deadline, and populates your dashboard." },
  { q: "Can creators use it for free?", a: "Yes. Creators do not need accounts. They click a secure Magic Link to upload their proof of work." },
  { q: "Is WhatsApp integration included?", a: "Yes, automated WhatsApp reminders to creators are included in the Pro tier." }
];

export function FaqSection() {
  return (
    <section className="py-24 relative bg-[#071126] border-t border-[#1E293B]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FaqItem key={i} faq={faq} />
          ))}
        </div>

      </div>
    </section>
  );
}

function FaqItem({ faq }: { faq: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#1E293B] rounded-lg bg-[#081428] overflow-hidden hover:border-[#00D4A5]/50 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 text-left focus:outline-none"
      >
        <span className="font-bold text-white">{faq.q}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-[#94A3B8] transition-transform duration-300",
            isOpen ? "rotate-180 text-[#00D4A5]" : ""
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 text-[#94A3B8] text-sm leading-relaxed border-t border-[#1E293B] pt-4">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
