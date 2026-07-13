'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import {
  MessageSquare,
  LayoutDashboard,
  CheckCircle,
  ArrowRight,
  Shield,
  Smartphone,
  Sparkles,
  Zap,
  Star,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  Check,
  Wand2,
  BellRing,
  Link as LinkIcon
} from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        router.push('/dashboard');
      }
    });

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [supabase.auth, router]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/5 bg-[#020617]/70 backdrop-blur-2xl shadow-2xl shadow-black/50'
          : 'border-b border-transparent bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={26} href="/" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-[13px] font-semibold text-slate-400 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#workflow" className="text-[13px] font-semibold text-slate-400 hover:text-white transition-colors">
              Workflow
            </Link>
            <Link href="#pricing" className="text-[13px] font-semibold text-slate-400 hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-[13px] font-semibold text-slate-300 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-white/5 border border-white/10 px-4 py-2 rounded-lg overflow-hidden transition-all hover:bg-white/10 hover:border-white/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              Start 30-Day Trial
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
          <div className="md:hidden glass-premium border-t border-white/5 animate-slide-down pb-4">
            <nav className="flex flex-col">
              {[
                { href: '#features', label: 'Features' },
                { href: '#workflow', label: 'Workflow' },
                { href: '#pricing', label: 'Pricing' },
                { href: '/login', label: 'Log in' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-6 py-4 border-b border-white/5 text-sm font-medium text-slate-300 hover:text-white"
                >
                  {label}
                </Link>
              ))}
              <div className="px-6 pt-4">
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex justify-center py-3 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-white"
                >
                  Start 30-Day Trial
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Vercel-style glow background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-emerald-500/20 via-teal-900/10 to-transparent blur-[100px] pointer-events-none" />
          <div className="noise-overlay absolute inset-0 opacity-[0.03]" />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-widest mb-8 animate-fade-in-up">
              <Sparkles className="w-3.5 h-3.5" />
              Collabo 2.0 is Live
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-[80px] font-bold text-white tracking-tighter mb-8 leading-[1.05] text-balance animate-fade-in-up stagger-1">
              Influencer marketing,{' '}
              <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">
                engineered for speed.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up stagger-2 text-balance font-medium">
              Turn messy WhatsApp negotiations into structured campaigns instantly. Track deliverables, automate reminders, and measure ROI—without ever opening a spreadsheet.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-in-up stagger-3">
              <Link href="/signup" className="group relative inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-[#020617] font-bold text-sm transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                Start 30-Day Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest animate-fade-in-up stagger-4">
              No credit card required
            </p>
          </div>

          {/* Dashboard Preview Overlay */}
          <div className="max-w-6xl mx-auto mt-20 px-4 sm:px-6 lg:px-8 relative animate-fade-in-up stagger-5 perspective-[2000px]">
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 shadow-[0_0_100px_rgba(16,185,129,0.1)] overflow-hidden" 
                 style={{ transform: 'rotateX(8deg) translateY(-20px)', transformStyle: 'preserve-3d' }}>
              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 h-full" />
              <Image src="/images/dashboard.png" alt="Collabo Dashboard" width={1200} height={800} className="w-full h-auto object-cover opacity-90 block" />
            </div>
          </div>
        </section>

        {/* ── Social Proof Logos ─────────────────────────────────────────── */}
        <section className="py-12 border-y border-white/5 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">Trusted by scaling D2C brands</p>
            <div className="flex flex-wrap justify-center items-center gap-10 sm:gap-16 opacity-40 grayscale hover:opacity-60 transition-opacity duration-500">
              <span className="text-xl font-bold font-serif tracking-tight">Minimalist.</span>
              <span className="text-xl font-black italic tracking-tighter">FITNESS+</span>
              <span className="text-xl font-bold tracking-widest">GLOW</span>
              <span className="text-xl font-light tracking-[0.3em]">NATURE</span>
              <span className="text-xl font-extrabold tracking-tighter">KetoInd</span>
            </div>
          </div>
        </section>

        {/* ── Bento Grid Features ────────────────────────────────────────── */}
        <section id="features" className="py-32 relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4">
                Everything you need. <br className="hidden sm:block" />
                <span className="text-slate-500">Nothing you don't.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
              {/* Feature 1 (Large) */}
              <div className="bento-card md:col-span-2 md:row-span-2 p-8 flex flex-col justify-between group">
                <div className="mb-8">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                    <Wand2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">AI Campaign Extraction</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Dump your messy chat logs or screenshots. Our AI instantly parses deliverables, budgets, and deadlines into a structured database.
                  </p>
                </div>
                <div className="relative h-48 rounded-xl overflow-hidden border border-white/5">
                  <Image src="/images/ai-extraction.png" alt="AI Extraction" width={800} height={600} className="w-full h-full object-cover object-left-top opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Feature 2 (Small) */}
              <div className="bento-card p-6 flex flex-col justify-center">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <BellRing className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Auto Reminders</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Never chase an influencer again. Automated WhatsApp and Email reminders 48hrs before deadlines.
                </p>
              </div>

              {/* Feature 3 (Small) */}
              <div className="bento-card p-6 flex flex-col justify-center">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <LinkIcon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Magic Links</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Creators submit proof of work via a secure link. No account creation required for them.
                </p>
              </div>

              {/* Feature 4 (Small) */}
              <div className="bento-card p-6 flex flex-col justify-center">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">WhatsApp Sync</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Forward chats directly to our bot. Campaigns are created instantly in your dashboard.
                </p>
              </div>

              {/* Feature 5 (Wide) */}
              <div className="bento-card md:col-span-2 p-6 flex items-center gap-8">
                <div className="flex-1">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                    <BarChart3 className="w-5 h-5 text-rose-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Real-Time Analytics</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Track ROI, monitor spending across platforms, and measure on-time delivery rates instantly.
                  </p>
                </div>
                <div className="hidden sm:block flex-1 border-l border-white/5 pl-8">
                   <div className="space-y-3">
                     <div className="flex justify-between items-end">
                       <span className="text-xs text-slate-500">Monthly Spend</span>
                       <span className="text-lg font-bold text-emerald-400">₹4.2L</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[70%]" />
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Workflow Steps ─────────────────────────────────────────────── */}
        <section id="workflow" className="py-24 border-y border-white/5 bg-slate-900/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                From DM to Done in seconds.
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0" />
              
              {[
                { step: '01', title: 'Negotiate', desc: 'Chat on WhatsApp or DMs as usual. Forward the final deal to Collabo.' },
                { step: '02', title: 'Extract', desc: 'Collabo AI reads the chat and logs deliverables, budget, and deadlines.' },
                { step: '03', title: 'Track', desc: 'The system auto-reminds the creator and marks the campaign complete upon proof.' }
              ].map((s, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#020617] border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <span className="text-sm font-bold text-emerald-400">{s.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 text-sm max-w-[250px] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────────────── */}
        <section className="py-32 relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Built for operators.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  quote: 'We were drowning in WhatsApp chats and messy spreadsheets. Collabo turned our chaos into a clean, trackable dashboard instantly.',
                  author: 'Rahul S.',
                  role: 'Founder, Minimalist',
                },
                {
                  quote: 'The automated reminders alone saved us from missing 3 critical launch deadlines this month. An essential tool for our marketing team.',
                  author: 'Priya M.',
                  role: 'Marketing Head, GLOW',
                },
                {
                  quote: 'As a bootstrap D2C brand, every rupee counts. Switching to Collabo helped us scale creator collabs by 3x at a fraction of the cost of an agency.',
                  author: 'Arjun K.',
                  role: 'Co-Founder, KetoInd',
                },
              ].map((t, i) => (
                <div key={i} className="bento-card p-8 flex flex-col justify-between">
                  <p className="text-slate-300 text-sm leading-relaxed mb-8">"{t.quote}"</p>
                  <div>
                    <p className="text-white font-bold text-sm">{t.author}</p>
                    <p className="text-slate-500 text-[11px] uppercase tracking-widest mt-1">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing & CTA ──────────────────────────────────────────────── */}
        <section id="pricing" className="py-24 relative overflow-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-[2rem] border border-emerald-500/20 bg-[#020617] p-10 sm:p-16 text-center shadow-[0_0_100px_rgba(16,185,129,0.1)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4 relative z-10">
                Start your 30-Day Free Trial
              </h2>
              <p className="text-slate-400 mb-10 max-w-lg mx-auto relative z-10">
                Get full access to AI Extraction, WhatsApp Sync, and Unlimited Campaigns. Only ₹299/month after. Cancel anytime.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                <Link href="/signup" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-emerald-500 text-[#020617] font-bold text-sm transition-all hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  Start Free Trial
                </Link>
                <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-white/5 text-white font-bold text-sm border border-white/10 hover:bg-white/10 transition-all">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#020617] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-16">
            <div>
              <Logo variant="full" size={24} href="/" className="mb-4" />
              <p className="text-xs text-slate-500 max-w-xs">
                The modern influencer campaign management platform.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-widest mb-4">Product</p>
                <ul className="space-y-3">
                  {['Features', 'Pricing', 'Login', 'Sign Up'].map((l) => (
                    <li key={l}>
                      <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-widest mb-4">Legal</p>
                <ul className="space-y-3">
                  {['Privacy Policy', 'Terms of Service', 'Refund Policy'].map((l) => (
                    <li key={l}>
                      <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} Collabo. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
