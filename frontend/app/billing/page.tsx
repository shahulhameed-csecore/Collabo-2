'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBillingUsage, BillingUsage } from '@/lib/api';
import { CreditCard, Zap, Check, Shield, Sparkles, TrendingUp, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await getBillingUsage();
        setUsage(data);
      } catch (err) {
        // Silently handle backend failure by falling back to null state
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const campaignsUsed = usage?.campaigns_this_month || 0;
  const campaignsLimit = 5;
  const usagePercentage = Math.min(100, Math.round((campaignsUsed / campaignsLimit) * 100));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-500" />
              Usage & Billing
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Manage your plan, billing details, and API usage.</p>
          </div>
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
            {/* Upgrade CTA / Active Plan Card */}
            <div className="relative group md:col-span-1 rounded-3xl p-[1px] bg-gradient-to-b from-emerald-400 to-teal-600 shadow-xl shadow-emerald-500/10 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-300/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="bg-white dark:bg-slate-950/90 h-full w-full rounded-[23px] p-6 relative z-10 flex flex-col justify-between backdrop-blur-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">Active Plan</h3>
                    <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                      FREE TIER
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    You're currently on the free plan. Upgrade to unlock unlimited campaigns, deep analytics, and CRM.
                  </p>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold rounded-xl px-5 py-3 transition-all shadow-lg shadow-emerald-500/25">
                  <Sparkles className="w-4 h-4" /> Upgrade to Pro
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Campaigns Tracked
                </h3>
                <div className="flex items-end gap-2 mb-2">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">{campaignsUsed}</p>
                  <p className="text-sm font-semibold text-slate-400 mb-1">/ {campaignsLimit} used</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Usage limit</span>
                  <span>{usagePercentage}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${usagePercentage > 80 ? 'bg-rose-500' : 'bg-purple-500'}`}
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                {usagePercentage > 80 && (
                  <p className="text-xs text-rose-500 font-medium mt-3">You are approaching your free limit.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  AI Extractions
                </h3>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">{usage?.ai_extractions_used || 0}</p>
                  <p className="text-sm font-semibold text-slate-400 mb-1">Lifetime total</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                Save hours of manual data entry by forwarding briefs or screenshots to our WhatsApp bot.
              </p>
            </div>
          </div>
        )}

        {/* Pricing Table */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Supercharge your influencer marketing</h2>
          <p className="text-slate-500 text-sm mb-8">Stop using spreadsheets. Start acting like an enterprise.</p>
          
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700/50">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${!isAnnual ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${isAnnual ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Yearly <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            {/* Free Plan */}
            <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm relative">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-500 mb-6 h-10">Perfect for small brands testing the waters.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">₹0</span>
                <span className="text-slate-500 font-medium">/ forever</span>
              </div>
              <button className="w-full py-3 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors mb-8">
                Current Plan
              </button>
              <ul className="space-y-4">
                {[
                  "Up to 5 campaigns per month",
                  "Basic WhatsApp AI Extractions",
                  "Email Reminders Only",
                  "Basic Creator List"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                    <Check className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-3xl border border-slate-800 dark:border-emerald-500/30 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
              <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-emerald-400" /> Most Popular
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 relative z-10">Collabo Pro</h3>
              <p className="text-sm text-slate-400 mb-6 h-10 relative z-10">Everything you need to scale influencer marketing profitably.</p>
              <div className="flex items-baseline gap-1 mb-6 relative z-10">
                <span className="text-4xl font-black text-white">{isAnnual ? '₹399' : '₹499'}</span>
                <span className="text-slate-400 font-medium">/ month</span>
              </div>
              <button className="relative z-10 w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 mb-8 flex items-center justify-center gap-2 group/btn">
                Upgrade to Pro <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
              
              <ul className="space-y-4 relative z-10">
                {[
                  "Unlimited active campaigns",
                  "Priority Multimodal AI Extractions",
                  "Automated WhatsApp Reminders",
                  "Advanced Influencer CRM & History",
                  "Real-time ROI & Click Analytics",
                  "Premium Support"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
