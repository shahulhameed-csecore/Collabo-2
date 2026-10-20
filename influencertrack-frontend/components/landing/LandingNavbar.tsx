'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Menu, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LandingNavbar() {
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
    <header className={cn(
      "sticky top-0 w-full z-50 transition-all duration-200 border-b",
      scrolled 
        ? "border-white/[0.08] bg-[#05070B]/85 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
        : "border-white/[0.04] bg-[#05070B]/60 backdrop-blur-sm"
    )}>
      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-10">
          <Logo variant="full" size={26} href="/" theme="dark" />

          {/* Desktop Section Anchors */}
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
              className="text-center text-sm font-sans font-medium text-slate-300 hover:text-white py-2 rounded-lg border border-white/[0.08] bg-white/[0.02]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-center text-sm font-sans font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-[0_1px_8px_rgba(16,185,129,0.25)]"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
