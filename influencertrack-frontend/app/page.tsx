'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Menu, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import Consolidated 5-Block Architectural Components
import { HeroLiveDemo } from '@/components/landing/HeroLiveDemo';
import { BeforeAfterDashboard } from '@/components/landing/BeforeAfterDashboard';
import { BentoBenefits } from '@/components/landing/BentoBenefits';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
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

  const navLinks = [
    { href: '#pipeline', label: 'Pipeline' },
    { href: '#architecture', label: 'Architecture' },
    { href: '#workbench', label: 'Workbench' },
    { href: '#roi', label: 'ROI' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen bg-[#05070B] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 overflow-x-hidden">
      
      {/* ── STICKY ARCHITECTURAL NAVBAR ────────────────────────────────────── */}
      <header className={cn(
        "sticky top-0 w-full z-50 transition-all duration-200 border-b",
        scrolled 
          ? "border-white/[0.08] bg-[#05070B]/85 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
          : "border-white/[0.04] bg-[#05070B]/60 backdrop-blur-sm"
      )}>
        <div className="max-w-[1320px] mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-10">
            <Logo variant="full" size={26} href="/" theme="dark" />

            {/* Desktop Section Anchors (Smooth font-sans, relaxed tracking) */}
            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-sans font-medium text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-sans font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-xs font-sans font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 px-4 py-2 rounded-xl transition-all active:scale-[0.98] shadow-[0_1px_8px_rgba(16,185,129,0.25)] flex items-center gap-1.5"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0A0E17] border-b border-white/[0.08] px-6 py-6 shadow-2xl">
            <nav className="flex flex-col space-y-3.5 mb-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-sans font-medium text-slate-300 hover:text-emerald-400 py-1"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.06]">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl border border-white/[0.08] text-xs font-sans font-medium text-slate-200"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-emerald-400 text-xs font-sans font-medium text-[#05070B]"
              >
                Start 14-Day Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── MAIN UNCONSTRAINED EDITORIAL WRAPPER (1320px WIDE, NO CRAMPED RAILS) ── */}
      <div className="w-full relative">
        <main>
          {/* Block 1: Split-Pipeline Hero with WhatsApp Voice Note & Chat Bubbles */}
          <HeroLiveDemo />

          {/* Block 2: Interactive Chaos vs Command Comparison */}
          <BeforeAfterDashboard />

          {/* Block 3: Asymmetric 4-Cell Interactive Bento Workbench */}
          <BentoBenefits />

          {/* Block 4: Financial Terminal ROI & Time-Saved Calculator */}
          <RoiCalculator />

          {/* Block 5: Architectural Pricing Matrix, FAQ & Final CTA */}
          <PremiumPricing />
          <FaqSection />
          <FinalCta />
        </main>

        {/* ── EDITORIAL FOOTER ─────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] bg-[#070A10] py-14 px-6 sm:px-12 relative">
          <div className="max-w-[1320px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-3">
              <Logo variant="full" size={24} href="/" theme="dark" />
              <p className="text-xs text-slate-400 max-w-sm font-sans font-normal leading-relaxed">
                The zero-entry autonomous influencer campaign operating system for Indian D2C brands & agencies.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0E17] border border-white/[0.06] text-xs font-sans text-slate-400 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>All systems operational</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-10 text-xs font-sans text-slate-400">
              <div className="flex flex-col gap-2.5">
                <span className="text-slate-200 font-medium uppercase tracking-wider text-[11px]">Product</span>
                <Link href="#pipeline" className="hover:text-white transition-colors">Pipeline</Link>
                <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
                <Link href="#workbench" className="hover:text-white transition-colors">Workbench</Link>
                <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-slate-200 font-medium uppercase tracking-wider text-[11px]">Legal</span>
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-slate-200 font-medium uppercase tracking-wider text-[11px]">Access</span>
                <Link href="/login" className="hover:text-white transition-colors">Log In</Link>
                <Link href="/signup" className="hover:text-white transition-colors">Start Free Trial</Link>
                <span className="text-slate-500 font-mono">Bot: +91 63747 71074</span>
              </div>
            </div>
          </div>

          <div className="max-w-[1320px] mx-auto mt-10 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-sans text-slate-400 font-normal">
            <div>
              © {new Date().getFullYear()} Collabo (mycollabo.online). Built with precision for Indian D2C brands.
            </div>
            <div className="text-slate-400">
              Engineered for Indian D2C Brands & Agencies • Mumbai / Bengaluru
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
