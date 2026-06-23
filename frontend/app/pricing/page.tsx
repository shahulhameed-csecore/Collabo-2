'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { CheckCircle, X, Sparkles, ArrowRight, Shield } from 'lucide-react';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  const buttonBase = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none w-full";
  const buttonPrimary = `${buttonBase} bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] h-12 px-8`;
  const buttonSecondary = `${buttonBase} bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 hover:text-white h-12 px-8`;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={32} href="/" />
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex items-center justify-center rounded-xl text-xs font-semibold bg-white text-slate-950 hover:bg-slate-200 h-9 px-4 shadow-sm transition-colors">
              Try for Free
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16 relative">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none opacity-50 mix-blend-screen" />
           
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Start for free, upgrade when you need more power. Stop paying per-user fees to manage your influencer campaigns.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!isAnnual ? 'text-white font-semibold' : 'text-slate-400'}`}>Monthly</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm flex items-center gap-2 ${isAnnual ? 'text-white font-semibold' : 'text-slate-400'}`}>
              Annually <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-8 lg:gap-12 mb-24">
          {/* Free Tier */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-400 h-10">Perfect for indie brands trying out automated tracking.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">₹0</span>
                <span className="text-slate-500">/ forever</span>
              </div>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {[
                "Up to 2 active campaigns",
                "Basic AI WhatsApp extraction",
                "Dashboard analytics",
                "Email support"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <CheckCircle className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Link href="/signup" className={buttonSecondary}>
              Get Started for Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="relative bg-[#020617] border-2 border-emerald-500/50 rounded-3xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.1)] flex flex-col transform md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Most Popular
            </div>
            
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
              <p className="text-sm text-slate-400 h-10">For growing D2C brands that want to scale their influencer channel.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  ₹{isAnnual ? '239' : '299'}
                </span>
                <span className="text-slate-500">/ month</span>
              </div>
              {isAnnual && <p className="text-xs text-emerald-400 mt-1">Billed ₹2,868 yearly</p>}
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {[
                "Unlimited active campaigns",
                "Priority AI extraction (instant)",
                "Automated creator reminders",
                "CSV Export & Reporting",
                "Custom deliverables tracking",
                "Priority WhatsApp support"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-200 font-medium">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <div className="space-y-3">
              <Link href="/signup" className={buttonPrimary}>
                Start 14-day Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" /> No credit card required to start
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Compare plans</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="py-4 px-6 text-sm font-semibold text-slate-400 border-b border-slate-800 w-1/2">Features</th>
                  <th className="py-4 px-6 text-sm font-semibold text-white border-b border-slate-800 text-center w-1/4">Starter</th>
                  <th className="py-4 px-6 text-sm font-semibold text-emerald-400 border-b border-slate-800 text-center w-1/4 bg-emerald-500/5 rounded-t-xl">Pro</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800">
                {[
                  { name: "Active Campaigns", starter: "2", pro: "Unlimited" },
                  { name: "AI WhatsApp Extraction", starter: "Standard", pro: "Priority" },
                  { name: "Dashboard Analytics", starter: true, pro: true },
                  { name: "Automated Reminders", starter: false, pro: true },
                  { name: "CSV Export", starter: false, pro: true },
                  { name: "Support", starter: "Email", pro: "Priority WhatsApp" },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300">{row.name}</td>
                    <td className="py-4 px-6 text-center text-slate-400">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? <CheckCircle className="w-5 h-5 mx-auto text-slate-500" /> : <X className="w-5 h-5 mx-auto text-slate-700" />
                      ) : row.starter}
                    </td>
                    <td className="py-4 px-6 text-center text-white bg-emerald-500/5">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <CheckCircle className="w-5 h-5 mx-auto text-emerald-400" /> : <X className="w-5 h-5 mx-auto text-slate-700" />
                      ) : <span className="font-semibold">{row.pro}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <Logo variant="full" size={24} href="/" className="grayscale opacity-50" />
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Collabo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
