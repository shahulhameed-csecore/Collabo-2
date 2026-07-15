'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  { q: "Is my data secure?", a: "Yes. We use industry-standard encryption. Your WhatsApp data is only used for extraction and is never shared with third parties." },
  { q: "How does AI extraction work?", a: "Simply forward a WhatsApp chat or upload a screenshot. Our Gemini-powered AI reads the text, identifies the deliverables, budget, and deadline, and populates your dashboard automatically." },
  { q: "Can creators use it for free?", a: "Absolutely. Creators do not even need to create an account. They click a secure Magic Link to upload their proof of work." },
  { q: "Is WhatsApp integration included?", a: "Yes, automated WhatsApp reminders to creators are included in the Pro tier to ensure you never miss a deadline." },
  { q: "How long does AI extraction take?", a: "Usually under 5 seconds. It is nearly instantaneous." },
  { q: "Is Collabo suitable for small businesses?", a: "Yes! In fact, it's designed specifically for small, founder-led D2C teams who don't have dedicated influencer logistics staff." },
  { q: "Can I manage multiple campaigns?", a: "Yes, the Pro tier allows unlimited campaigns and influencer tracking." }
];

export function FaqSection() {
  return (
    <section className="py-32 relative bg-[#020617]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
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
    <div className="border border-slate-800 rounded-2xl bg-[#0F172A] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 text-left focus:outline-none focus-visible:ring focus-visible:ring-indigo-500 focus-visible:ring-opacity-75"
      >
        <span className="font-semibold text-white text-lg">{faq.q}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isOpen ? "rotate-180" : ""
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
            <div className="px-6 pb-6 text-slate-400 leading-relaxed border-t border-slate-800/50 pt-4">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
