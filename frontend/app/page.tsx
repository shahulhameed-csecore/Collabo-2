'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import all new Landing Page Sections
import { HeroSection } from '@/components/landing/HeroSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { QuickHowItWorks } from '@/components/landing/QuickHowItWorks';
import { MagicMomentTimeline } from '@/components/landing/MagicMomentTimeline';
import { BeforeAfter } from '@/components/landing/BeforeAfter';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { InteractiveShowcase } from '@/components/landing/InteractiveShowcase';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
import { SocialProof } from '@/components/landing/SocialProof';
import { TargetAudience } from '@/components/landing/TargetAudience';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FinalCta } from '@/components/landing/FinalCta';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        scrolled 
          ? "border-b border-slate-800 bg-[#020617]/70 backdrop-blur-2xl shadow-2xl shadow-black/50" 
          : "border-b border-transparent bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={26} href="/" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#how-it-works" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-400 px-5 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0F172A] border-t border-slate-800 pb-4 shadow-2xl">
            <nav className="flex flex-col">
              {[
                { href: '#how-it-works', label: 'How it works' },
                { href: '#pricing', label: 'Pricing' },
                { href: '/login', label: 'Log in' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-6 py-4 border-b border-slate-800 text-sm font-medium text-slate-300 hover:text-white"
                >
                  {label}
                </Link>
              ))}
              <div className="px-6 pt-4">
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex justify-center py-3 bg-indigo-500 rounded-lg text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
                >
                  Start Free Trial
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main>
        <HeroSection />
        <ProblemSection />
        <div id="how-it-works">
          <QuickHowItWorks />
        </div>
        <MagicMomentTimeline />
        <BeforeAfter />
        <BentoFeatures />
        <InteractiveShowcase />
        <RoiCalculator />
        <SocialProof />
        <TargetAudience />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-[#020617] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Logo variant="full" size={24} href="/" />
            <p className="text-slate-500 text-sm">
              The AI-Powered Influencer Campaign Operating System.
            </p>
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
