'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { BarChart3, TrendingUp, Users, DollarSign, Sparkles, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getBillingUsage, BillingUsage } from '@/lib/api';

export default function AnalyticsPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);

  useEffect(() => {
    getBillingUsage().then(setUsage).catch(() => {});
  }, []);

  const isPro = usage?.current_plan === 'pro';

  if (!isPro) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-900/50 border border-slate-800/60 shadow-xl mb-6">
              <Lock className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-4">Unlock Premium Analytics</h1>
            <p className="text-slate-400 text-lg max-w-lg mx-auto mb-8">
              Upgrade to the Pro tier to access deep insights, influencer ROI tracking, and custom reports.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5" /> Upgrade to Pro for ₹2,499/mo
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
              Campaign Analytics
            </h1>
            <p className="text-slate-500 mt-1">Track your ROI and influencer performance.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Total ROI</h3>
            <p className="text-4xl font-black text-emerald-400">2.4x</p>
            <p className="text-xs text-slate-500 mt-2">Based on self-reported sales</p>
          </div>
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Top Platform</h3>
            <p className="text-4xl font-black text-blue-400">Instagram</p>
            <p className="text-xs text-slate-500 mt-2">78% of your campaigns</p>
          </div>
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/60">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Average Spend</h3>
            <p className="text-4xl font-black text-amber-400">₹14,500</p>
            <p className="text-xs text-slate-500 mt-2">Per influencer</p>
          </div>
        </div>

        {/* Placeholder chart area */}
        <div className="h-96 w-full bg-slate-900/40 border border-slate-800/50 rounded-2xl flex flex-col items-center justify-center text-center p-6">
          <TrendingUp className="w-12 h-12 text-slate-700 mb-4" />
          <h2 className="text-xl font-bold text-slate-400">Performance Over Time</h2>
          <p className="text-slate-600 mt-2">Connect your tracking links to populate real-time charts.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
