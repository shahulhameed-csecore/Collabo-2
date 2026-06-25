'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBillingUsage, BillingUsage } from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard, Zap, Check, Shield, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await getBillingUsage();
        setUsage(data);
      } catch (err) {
        toast.error('Failed to load billing usage');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const calculateDaysLeft = (dateString: string | null) => {
    if (!dateString) return 0;
    const end = new Date(dateString);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  const daysLeft = usage ? calculateDaysLeft(usage.trial_ends_at) : 0;
  const isTrialActive = daysLeft > 0;
  const isPro = usage?.current_plan === 'pro';

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-500" />
              Usage & Billing
            </h1>
            <p className="text-slate-500 mt-1">Manage your plan, billing details, and current usage.</p>
          </div>
          
          <Link href="/pricing" className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
            <Sparkles className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            Upgrade to Pro
          </Link>
        </div>

        {/* Current Usage Overview */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Current Plan</h3>
                {isPro || isTrialActive ? (
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                    PRO
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                    FREE
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {isPro ? '₹2,499' : '₹0'}<span className="text-sm font-normal text-slate-500"> / month</span>
              </p>
              {isTrialActive && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                  {daysLeft} days left in Trial
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4">Campaigns This Month</h3>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-slate-900 dark:text-white">{usage?.campaigns_this_month || 0}</p>
                <p className="text-sm text-slate-500 mb-1">/ {isPro || isTrialActive ? 'Unlimited' : '5'}</p>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${(!isPro && !isTrialActive && (usage?.campaigns_this_month || 0) >= 5) ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: isPro || isTrialActive ? '15%' : `${Math.min(((usage?.campaigns_this_month || 0) / 5) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                AI Extractions
              </h3>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-slate-900 dark:text-white">{usage?.ai_extractions_used || 0}</p>
                <p className="text-sm text-slate-500 mb-1">Total used</p>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                Save hours of manual data entry by forwarding briefs or DMs to our WhatsApp bot.
              </p>
            </div>
          </div>
        )}

        {/* Feature Comparison Table */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 text-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Choose the right plan for your team</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
                  <th className="px-6 py-4 text-left font-semibold text-slate-900 dark:text-white w-1/3">Features</th>
                  <th className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">Free</th>
                  <th className="px-6 py-4 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {[
                  { feature: "Active Campaigns", free: "Up to 5/month", pro: "Unlimited" },
                  { feature: "AI Extractions via WhatsApp", free: "Basic", pro: "Priority + Multimodal" },
                  { feature: "Automated Reminders", free: "Email only", pro: "Email + WhatsApp" },
                  { feature: "Influencer CRM", free: "Basic List", pro: "Advanced Notes & History" },
                  { feature: "Content Calendar View", free: false, pro: true },
                  { feature: "Bulk Actions & Exports", free: false, pro: true },
                  { feature: "Priority Support", free: false, pro: true },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{row.feature}</td>
                    <td className="px-6 py-4 text-center bg-slate-50/30 dark:bg-slate-800/30">
                      {typeof row.free === 'boolean' ? (
                        row.free ? <Check className="w-5 h-5 mx-auto text-slate-400" /> : <span className="text-slate-300 dark:text-slate-700">—</span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400">{row.free}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center bg-emerald-50/30 dark:bg-emerald-900/5">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? <Check className="w-5 h-5 mx-auto text-emerald-500 drop-shadow-sm" /> : <span className="text-slate-300 dark:text-slate-700">—</span>
                      ) : (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{row.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-8 flex justify-center bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/60">
            <Link href="/pricing" className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:-translate-y-0.5">
              <Shield className="w-5 h-5" />
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
