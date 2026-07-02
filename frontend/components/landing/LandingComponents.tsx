'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Bell,
  Smartphone,
  Users,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000 }: {
  end: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = Date.now();
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(ease * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

export function FeatureBadge({ icon: Icon, text, color }: { icon: React.ElementType; text: string; color: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${color}`}>
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
}

export function DashboardMockup() {
  return (
    <div
      className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
      style={{ transform: 'perspective(1200px) rotateX(8deg) scale(1.01)', transformStyle: 'preserve-3d' }}
    >
      <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-950/70">
        <div className="w-3 h-3 rounded-full bg-rose-500/80 ring-1 ring-rose-600/40" />
        <div className="w-3 h-3 rounded-full bg-amber-500/80 ring-1 ring-amber-600/40" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/80 ring-1 ring-emerald-600/40" />
        <div className="ml-4 flex-1 h-5 max-w-[180px] bg-slate-800 rounded-md flex items-center px-2">
          <span className="text-[9px] text-slate-500">mycollabo.online/dashboard</span>
        </div>
      </div>

      <div className="flex h-[340px] sm:h-[380px]">
        <div className="w-[52px] sm:w-[160px] border-r border-slate-800 bg-slate-900/90 flex flex-col p-2 sm:p-3 gap-1">
          <div className="h-6 w-full bg-slate-800/80 rounded-lg mb-3 hidden sm:block" />
          {['Campaigns', 'Calendar', 'Influencers', 'Analytics'].map((item, i) => (
            <div key={i} className={`h-7 flex items-center gap-2 rounded-lg px-2 ${i === 0 ? 'bg-emerald-500/15 border border-emerald-500/20' : ''}`}>
              <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${i === 0 ? 'bg-emerald-400' : 'bg-slate-700'}`} />
              <span className="text-[9px] text-slate-500 hidden sm:block truncate">{item}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 p-3 sm:p-4 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Active', val: '12', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Overdue', val: '2', color: 'text-rose-400', bg: 'bg-rose-500/10' },
              { label: 'Budget', val: '₹2.4L', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Rate', val: '94%', color: 'text-blue-400', bg: 'bg-blue-500/10' },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} border border-slate-800/80 rounded-xl p-2`}>
                <p className="text-[8px] text-slate-600 mb-0.5">{card.label}</p>
                <p className={`text-xs font-bold ${card.color}`}>{card.val}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-800/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="border-b border-slate-800 px-3 py-2 flex items-center justify-between">
              <span className="text-[9px] font-semibold text-white">All Campaigns</span>
              <div className="w-12 h-4 bg-emerald-500/30 rounded-md" />
            </div>
            {[
              { name: 'Riya Sharma', platform: 'IG', status: 'Active', amount: '₹15K' },
              { name: 'TechGuru', platform: 'YT', status: 'Draft', amount: '₹45K' },
              { name: 'Sneha Styles', platform: 'IG', status: 'Paid', amount: 'Barter' },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[5px] font-bold text-white">{row.name[0]}</span>
                </div>
                <span className="text-[8px] text-slate-300 flex-1 truncate hidden sm:block">{row.name}</span>
                <span className={`text-[7px] px-1.5 py-0.5 rounded font-semibold ${
                  row.platform === 'IG' ? 'bg-pink-500/20 text-pink-400' : 'bg-red-500/20 text-red-400'
                }`}>{row.platform}</span>
                <span className={`text-[7px] px-1.5 py-0.5 rounded font-semibold ${
                  row.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' :
                  row.status === 'Draft' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{row.status}</span>
                <span className="text-[8px] text-slate-400 hidden sm:block">{row.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#020617] to-transparent pointer-events-none" />
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative pt-28 pb-16 lg:pt-44 lg:pb-24 overflow-hidden">
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/8 rounded-full blur-[120px] animate-blob" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-teal-500/6 rounded-full blur-[100px] animate-blob stagger-4" />
      <div className="noise-overlay absolute inset-0" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-in-up shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Built for Indian D2C Brands
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-6 leading-[1.08] text-balance animate-fade-in-up stagger-1">
          Stop managing influencers{' '}
          <br className="hidden sm:block" />
          in{' '}
          <span className="gradient-text-hero">messy spreadsheets.</span>
        </h1>

        <p className="text-base sm:text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed animate-fade-in-up stagger-2 text-balance">
          Log negotiations, budget, and deliverables in seconds. Track every creator deal
          in your custom campaign dashboard — all in one place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 animate-fade-in-up stagger-3">
          <FeatureBadge icon={Zap} text="AI Extraction" color="text-amber-400 border-amber-500/20 bg-amber-500/8" />
          <FeatureBadge icon={Bell} text="Auto Reminders" color="text-blue-400 border-blue-500/20 bg-blue-500/8" />
          <FeatureBadge icon={Shield} text="Secure & Private" color="text-emerald-400 border-emerald-500/20 bg-emerald-500/8" />
          <FeatureBadge icon={Smartphone} text="Mobile Friendly" color="text-purple-400 border-purple-500/20 bg-purple-500/8" />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5 animate-fade-in-up stagger-4">
          <Link href="/signup" className="btn-primary text-sm sm:text-base w-full sm:w-auto">
            Start Free Trial
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-semibold text-slate-300 border border-slate-700/80 hover:border-slate-600 hover:text-white hover:bg-slate-800/60 transition-all duration-200"
          >
            Login to Dashboard
          </Link>
        </div>

        <p className="text-xs text-slate-600 flex items-center justify-center gap-1.5 animate-fade-in-up stagger-5">
          <Shield className="w-3.5 h-3.5 text-slate-700" />
          No credit card required · Cancel anytime · 14-day free trial
        </p>
      </div>

      <div className="max-w-5xl mx-auto mt-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up stagger-6">
        <DashboardMockup />
      </div>
    </section>
  );
}

export function SocialProofSection() {
  return (
    <section className="py-14 border-y border-white/5 bg-slate-900/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { end: 500, suffix: '+', label: 'D2C Brands', icon: Users, color: 'text-emerald-400' },
            { end: 10, suffix: 'hrs', prefix: '', label: 'Saved per Week', icon: Clock, color: 'text-blue-400' },
            { end: 3, suffix: 'x', label: 'Faster Tracking', icon: TrendingUp, color: 'text-amber-400' },
            { end: 99, suffix: '%', label: 'Uptime SLA', icon: Shield, color: 'text-purple-400' },
          ].map(({ end, suffix, prefix, label, icon: Icon, color }, i) => (
            <div key={i} className="flex flex-col items-center gap-2 group">
              <div className={`p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30 mb-1 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-3xl sm:text-4xl font-extrabold ${color}`}>
                <AnimatedCounter end={end} suffix={suffix} prefix={prefix ?? ''} />
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
