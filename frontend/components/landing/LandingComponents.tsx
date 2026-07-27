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

import Image from 'next/image';

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
          Manage 100+ Influencers{' '}
          <br className="hidden sm:block" />
          with{' '}
          <span className="gradient-text-hero">Zero Spreadsheets.</span>
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
            Start 14-Day Free Trial
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
        <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] overflow-hidden" style={{ transform: 'perspective(1200px) rotateX(8deg) scale(1.01)', transformStyle: 'preserve-3d' }}>
          <Image src="/images/dashboard.png" alt="Collabo Dashboard" width={1200} height={800} className="w-full h-auto object-cover opacity-90" />
        </div>
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
