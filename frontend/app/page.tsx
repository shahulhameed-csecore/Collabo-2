'use client';

import { useState, useEffect, useRef } from 'react';
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
  TrendingUp,
  Clock,
  Users,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  Bell,
  FileText,
  DollarSign,
  Check,
} from 'lucide-react';

import {
  AnimatedCounter,
  FeatureBadge,
  DashboardMockup,
  HeroSection,
  SocialProofSection
} from '@/components/landing/LandingComponents';

/* ─────────────────────────────────────────────────────────────────────────────
   Main Landing Page
   ───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setIsAuthenticated(true);
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
          ? 'border-b border-white/8 bg-[#020617]/90 backdrop-blur-xl shadow-lg shadow-black/20'
          : 'border-b border-transparent bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={28} href="/" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors link-underline">
              Pricing
            </Link>
            <Link href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors link-underline">
              Features
            </Link>
            <Link href="#testimonials" className="text-sm font-medium text-slate-400 hover:text-white transition-colors link-underline">
              Testimonials
            </Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-slate-800/60">
              Log in
            </Link>
            <Link
              href="/signup"
              className="btn-primary text-sm h-9 px-5 py-0 rounded-xl"
            >
              Start 30-Day Trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass-premium border-t border-white/5 animate-slide-down">
            <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              {[
                { href: '/pricing', label: 'Pricing' },
                { href: '#features', label: 'Features' },
                { href: '#testimonials', label: 'Testimonials' },
                { href: '/login', label: 'Log in' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  {label}
                </Link>
              ))}
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary mt-2 text-sm text-center"
              >
                Start 30-Day Trial
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <HeroSection />

        {/* ── Social Proof Numbers ───────────────────────────────────────── */}
        <SocialProofSection />

        {/* ── Trust Logos ────────────────────────────────────────────────── */}
        <section className="py-10 bg-[#020617]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-6">Trusted by fast-growing brands</p>
            <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-14 opacity-30 grayscale hover:opacity-40 transition-opacity duration-500">
              <span className="text-lg font-bold font-serif">Minimalist.</span>
              <span className="text-lg font-black italic">FITNESS+</span>
              <span className="text-lg font-bold tracking-tighter">GLOW</span>
              <span className="text-lg font-light tracking-widest">NATURE</span>
              <span className="text-lg font-bold">KetoInd</span>
            </div>
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <section id="features" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/8 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
                <BarChart3 className="w-3.5 h-3.5" />
                Simple Process
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 text-balance">
                How Collabo Works
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto text-base sm:text-lg">
                From messy DMs to structured campaigns in three simple steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 lg:gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-emerald-500/20 -translate-y-1" />

              {[
                {
                  num: '01',
                  icon: MessageSquare,
                  title: 'Negotiate Normally',
                  desc: 'Chat with creators on WhatsApp, DMs, or email — just like you always do. No new tools for creators.',
                  accent: 'emerald',
                  delay: '',
                },
                {
                  num: '02',
                  icon: LayoutDashboard,
                  title: 'Log in Seconds',
                  desc: 'Paste your chat or upload a screenshot. Our AI auto-fills deliverables, budget, and deadlines instantly.',
                  accent: 'blue',
                  delay: 'stagger-2',
                },
                {
                  num: '03',
                  icon: CheckCircle,
                  title: 'Track Everything',
                  desc: 'Approve content, track payments, get deadline reminders — your entire creator pipeline, organized.',
                  accent: 'purple',
                  delay: 'stagger-4',
                },
              ].map((step, i) => {
                const colors = {
                  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/40 hover:shadow-emerald-500/10', num: 'text-emerald-500/40' },
                  blue:    { icon: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    hover: 'hover:border-blue-500/40 hover:shadow-blue-500/10',    num: 'text-blue-500/40' },
                  purple:  { icon: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  hover: 'hover:border-purple-500/40 hover:shadow-purple-500/10',  num: 'text-purple-500/40' },
                }[step.accent];

                return (
                  <div key={i} className={`group relative bg-slate-900/60 border ${colors!.border} ${colors!.hover} rounded-2xl p-7 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 card-hover ${step.delay} animate-fade-in-up`}>
                    <span className={`absolute top-5 right-5 text-5xl font-black ${colors!.num} leading-none`}>{step.num}</span>
                    <div className={`w-12 h-12 ${colors!.bg} border ${colors!.border} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
                      <step.icon className={`w-6 h-6 ${colors!.icon}`} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Features / Benefits ────────────────────────────────────────── */}
        <section className="py-24 bg-slate-900/25 border-y border-white/5 relative overflow-hidden">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 bg-emerald-500/5 rounded-full blur-[80px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left: Feature list */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  Why Collabo
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-5 leading-tight text-balance">
                  Scale your influencer marketing,{' '}
                  <span className="gradient-text">without the headcount.</span>
                </h2>
                <p className="text-slate-400 text-base mb-10 leading-relaxed">
                  Collabo acts as your automated campaign manager, so you can focus on building relationships instead of drowning in spreadsheets.
                </p>

                <div className="space-y-7">
                  {[
                    {
                      icon: CheckCircle,
                      title: 'Never Miss a Deliverable',
                      desc: 'Automated email and WhatsApp reminders ensure creators post on time. Get notified 48 hours before any deadline.',
                      color: 'emerald',
                    },
                    {
                      icon: Zap,
                      title: 'Save 10+ Hours a Week',
                      desc: 'Stop manually updating Google Sheets. Our platform auto-tracks payments, statuses, and organizes deliverables for you.',
                      color: 'blue',
                    },
                    {
                      icon: Shield,
                      title: 'Enterprise-Grade Security',
                      desc: 'Your campaign data is protected with Supabase Row-Level Security. Only you and your team can access your private campaigns.',
                      color: 'purple',
                    },
                    {
                      icon: BarChart3,
                      title: 'Real-Time Analytics',
                      desc: 'Track ROI, success rates, platform performance, and spending trends across all your campaigns at a glance.',
                      color: 'amber',
                    },
                  ].map((feature, i) => {
                    const c = {
                      emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
                      blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400' },
                      purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: 'text-purple-400' },
                      amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-400' },
                    }[feature.color];

                    return (
                      <div key={i} className="flex gap-4 items-start group">
                        <div className={`mt-0.5 flex-shrink-0 p-2.5 rounded-xl ${c!.bg} border ${c!.border} group-hover:scale-110 transition-transform duration-200`}>
                          <feature.icon className={`w-5 h-5 ${c!.icon}`} />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-white mb-1.5">{feature.title}</h4>
                          <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Illustration card */}
              <div className="relative lg:block">
                <div className="absolute inset-0 bg-emerald-500/15 blur-[80px] rounded-full pointer-events-none" />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 gradient-border">
                  <img src="/images/ai-extraction.png" alt="AI Extraction Feature" className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────────────── */}
        <section id="testimonials" className="py-24 relative overflow-hidden bg-[#020617]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                Social Proof
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 text-balance">
                Trusted by Indian Founders
              </h2>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                See how D2C brands are scaling their influencer marketing with Collabo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  quote: 'We were drowning in WhatsApp chats and messy spreadsheets. Collabo turned our chaos into a clean, trackable dashboard instantly.',
                  author: 'Rahul S.',
                  role: 'Founder, Minimalist',
                  initials: 'RS',
                  gradient: 'from-emerald-400 to-teal-500',
                  rating: 5,
                },
                {
                  quote: 'The automated reminders alone saved us from missing 3 critical launch deadlines this month. An essential tool for our marketing team.',
                  author: 'Priya M.',
                  role: 'Marketing Head, GLOW',
                  initials: 'PM',
                  gradient: 'from-blue-400 to-purple-500',
                  rating: 5,
                },
                {
                  quote: 'As a bootstrap D2C brand, every rupee counts. Switching to Collabo helped us scale creator collabs by 3x at a fraction of the cost of an agency.',
                  author: 'Arjun K.',
                  role: 'Co-Founder, KetoInd',
                  initials: 'AK',
                  gradient: 'from-amber-400 to-orange-500',
                  rating: 5,
                },
              ].map((t, i) => (
                <div
                  key={i}
                  className="group bg-slate-900/50 border border-slate-800 hover:border-emerald-500/25 rounded-2xl p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1 flex flex-col justify-between backdrop-blur-sm"
                >
                  <div>
                    {/* Stars */}
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    {/* Quote */}
                    <div className="relative mb-6">
                      <span className="absolute -top-2 -left-1 text-4xl text-emerald-500/20 font-serif leading-none">"</span>
                      <p className="text-slate-300 text-sm leading-relaxed pl-3">{t.quote}</p>
                    </div>
                  </div>
                  {/* Author */}
                  <div className="flex items-center gap-3 border-t border-slate-800 pt-5 mt-auto">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-white/5`}>
                      <span className="text-xs font-bold text-white">{t.initials}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.author}</p>
                      <p className="text-slate-500 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing Snippet / CTA ──────────────────────────────────────── */}
        <section className="py-20 bg-slate-900/25 border-y border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  plan: 'Free',
                  price: '₹0',
                  period: 'forever',
                  features: ['5 campaigns/month', 'Basic tracking', 'Email reminders', 'CSV export'],
                  cta: 'Get Started Free',
                  href: '/signup',
                  highlight: false,
                },
                {
                  plan: 'Pro',
                  price: '₹299',
                  period: '/month',
                  features: ['Unlimited campaigns', 'AI extraction', 'WhatsApp reminders', 'Analytics', 'PDF reports', 'Priority support'],
                  cta: 'Start 30-Day Trial',
                  href: '/signup',
                  highlight: true,
                },
                {
                  plan: 'Team',
                  price: '₹799',
                  period: '/month',
                  features: ['Everything in Pro', '5 team members', 'Shared campaigns', 'Admin controls', 'API access'],
                  cta: 'Contact Sales',
                  href: 'mailto:support@mycollabo.online',
                  highlight: false,
                },
              ].map((plan, i) => (
                <div
                  key={i}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-emerald-500/15 to-slate-900/80 border border-emerald-500/30 shadow-xl shadow-emerald-500/10'
                      : 'bg-slate-900/60 border border-slate-800'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-base font-bold text-slate-300 mb-2">{plan.plan}</h3>
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-slate-500 text-sm">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-slate-400">
                        <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? 'text-emerald-400' : 'text-slate-600'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`w-full text-center py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                      plan.highlight
                        ? 'btn-primary'
                        : 'border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-800/60'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────────── */}
        <section className="py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-950/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] bg-teal-500/8 rounded-full blur-[80px] pointer-events-none" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5" />
              Start Today
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight text-balance leading-[1.08]">
              Ready to bring order{' '}
              <span className="gradient-text">to the chaos?</span>
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
              Join hundreds of D2C brands automating their influencer marketing with Collabo. Start free today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="btn-primary text-base w-full sm:w-auto shadow-2xl shadow-emerald-500/25 glow-emerald">
                Start 30-Day Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700 hover:border-slate-600 hover:text-white hover:bg-slate-800/50 transition-all">
                View Pricing
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-600">
              30-day free trial · ₹299/month after · Cancel anytime
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#020617] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Logo variant="full" size={24} href="/" className="mb-4" />
              <p className="text-sm text-slate-500 leading-relaxed max-w-[220px]">
                The modern influencer campaign management platform for Indian D2C brands.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Product</p>
              <ul className="space-y-2.5">
                {[
                  { href: '#features', label: 'Features' },
                  { href: '/pricing', label: 'Pricing' },
                  { href: '/dashboard', label: 'Dashboard' },
                  { href: '/changelog', label: 'Changelog' },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors link-underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Legal</p>
              <ul className="space-y-2.5">
                {[
                  { href: '/privacy', label: 'Privacy Policy' },
                  { href: '/terms', label: 'Terms of Service' },
                  { href: '/refund', label: 'Refund Policy' },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors link-underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Support</p>
              <ul className="space-y-2.5">
                {[
                  { href: 'mailto:support@mycollabo.online', label: 'Contact Us' },
                  { href: '/submit-proof', label: 'Submit Proof' },
                  { href: '/login', label: 'Login' },
                  { href: '/signup', label: 'Sign Up' },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-slate-500 hover:text-emerald-400 transition-colors link-underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} Collabo. All rights reserved. Made with ❤️ in India.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-600">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
