'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import V2 Dashboard-Driven Landing Page Sections
import { HeroLiveDemo } from '@/components/landing/HeroLiveDemo';
import { PainPointCards } from '@/components/landing/PainPointCards';
import { SimplifiedWorkflow } from '@/components/landing/SimplifiedWorkflow';
import { BeforeAfterDashboard } from '@/components/landing/BeforeAfterDashboard';
import { BentoBenefits } from '@/components/landing/BentoBenefits';
import { DashboardShowcase } from '@/components/landing/DashboardShowcase';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
import { TargetAudience } from '@/components/landing/TargetAudience';
import { PremiumPricing } from '@/components/landing/PremiumPricing';
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
    <div className="min-h-screen bg-[#030712] text-white font-sans selection:bg-[#00D4A5]/30 selection:text-[#00FFC8] overflow-x-hidden">
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        scrolled 
          ? "border-b border-[#1E293B] bg-[#030712]/80 backdrop-blur-xl shadow-2xl shadow-black/50" 
          : "border-b border-transparent bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={26} href="/" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#how-it-works" className="text-sm font-semibold text-[#94A3B8] hover:text-white transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="text-sm font-semibold text-[#94A3B8] hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-[#94A3B8] hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-bold text-[#030712] bg-[#00D4A5] hover:bg-[#00FFC8] px-5 py-2 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(0,212,165,0.3)]"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#94A3B8] hover:text-white transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#071126] border-t border-[#1E293B] pb-4 shadow-2xl">
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
                  className="px-6 py-4 border-b border-[#1E293B] text-sm font-medium text-[#94A3B8] hover:text-white"
                >
                  {label}
                </Link>
              ))}
              <div className="px-6 pt-4">
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex justify-center py-3 bg-[#00D4A5] hover:bg-[#00FFC8] rounded-lg text-sm font-bold text-[#030712] shadow-lg shadow-[#00D4A5]/20"
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
        <HeroLiveDemo />
        <PainPointCards />
        <div id="how-it-works">
          <SimplifiedWorkflow />
        </div>
        <BeforeAfterDashboard />
        <BentoBenefits />
        <DashboardShowcase />
        <RoiCalculator />
        <TargetAudience />
        <PremiumPricing />
        <FaqSection />
        <FinalCta />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1E293B] bg-[#030712] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <Logo variant="full" size={24} href="/" />
            <p className="text-[#94A3B8] text-sm">
              The AI-Powered Influencer Campaign Operating System.
            </p>
          </div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-sm text-[#94A3B8] hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-[#94A3B8] hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
