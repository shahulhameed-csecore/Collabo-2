import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

// Import Consolidated 5-Block Architectural Components
import { HeroLiveDemo } from '@/components/landing/HeroLiveDemo';
import { BeforeAfterDashboard } from '@/components/landing/BeforeAfterDashboard';
import { BentoBenefits } from '@/components/landing/BentoBenefits';
import { RoiCalculator } from '@/components/landing/RoiCalculator';
import { PremiumPricing } from '@/components/landing/PremiumPricing';
import { FaqSection } from '@/components/landing/FaqSection';
import { FinalCta } from '@/components/landing/FinalCta';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05070B] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 overflow-x-hidden">
      
      {/* ── STICKY ARCHITECTURAL NAVBAR (Client Island) ────────────────────── */}
      <LandingNavbar />

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
