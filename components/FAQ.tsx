'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "What is Collabo?",
    answer: "Collabo is a streamlined SaaS platform designed for D2C brands and agencies to manage influencer campaigns. It automates data extraction, tracks deadlines, and handles campaign proof submissions via Magic Links."
  },
  {
    question: "How does AI extraction work?",
    answer: "You simply upload a screenshot of your chat or forward it to our WhatsApp bot. Our AI instantly reads the conversation, extracting the influencer's name, deliverables, deadlines, and payment amounts into a structured database."
  },
  {
    question: "Is my influencer data secure?",
    answer: "Yes, absolutely. We use industry-standard encryption, strict access controls, and layer-based security. We do not use your campaign data to train public AI models."
  },
  {
    question: "Do creators need an account?",
    answer: "No! Creators receive a secure Magic Link where they can view campaign requirements and submit their live post URLs. This completely removes friction and ensures high compliance."
  },
  {
    question: "Does WhatsApp integration cost extra?",
    answer: "No, the WhatsApp bot integration is included in all our plans, allowing you to create and manage campaigns directly from your phone for free."
  },
  {
    question: "How long does AI extraction take?",
    answer: "Most extractions take between 5 to 15 seconds. Large PDFs or complex chats may take slightly longer, but you will always see a clear progress indicator."
  },
  {
    question: "Can I use Collabo for multiple campaigns?",
    answer: "Yes, you can manage unlimited campaigns concurrently on our Pro plan. The free tier includes up to 5 campaigns per month to help you get started."
  },
  {
    question: "Are payments handled securely?",
    answer: "We use Razorpay for secure billing and subscription management. Your payment details are encrypted and tokenized, meaning we never store your credit card information directly."
  },
  {
    question: "How do Magic Links work?",
    answer: "A Magic Link is a unique, secure URL generated for each campaign. You send this to the influencer, and they simply click it to see their tasks and submit proof of work—no password required."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Generate SEO schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <section className="py-24 relative" id="faq">
      {/* Inject SEO Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400">Everything you need to know about the product and billing.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index}
                className={`border border-white/5 rounded-2xl overflow-hidden transition-colors ${isOpen ? 'bg-slate-800/40' : 'bg-slate-900/20 hover:bg-slate-800/20'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                >
                  <span className="font-semibold text-slate-200">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
