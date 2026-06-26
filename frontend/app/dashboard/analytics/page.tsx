'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { BarChart3, TrendingUp, DollarSign, Target, Plus, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getCampaigns, getApiErrorMessage } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await getCampaigns();
        setCampaigns(data);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to load campaigns'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Calculations
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
  const avgSpend = campaigns.length > 0 ? Math.round(totalSpend / campaigns.length) : 0;
  
  // Find top platform
  const platforms = campaigns.map(c => c.platform).filter(Boolean);
  const platformCounts = platforms.reduce((acc, p) => {
    acc[p!] = (acc[p!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  let topPlatform = 'None yet';
  let topPlatformPercent = 0;
  if (platforms.length > 0) {
    const top = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];
    topPlatform = top[0];
    topPlatformPercent = Math.round((top[1] / platforms.length) * 100);
  }

  const isEmpty = !isLoading && campaigns.length === 0;

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

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-500/20">
              <BarChart3 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No data yet</h2>
            <p className="text-slate-500 max-w-md mb-6">Create your first campaign to unlock beautiful analytics and start tracking your influencer marketing performance.</p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-95">
              <Plus className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" /> Total Spend
                </h3>
                <p className="text-4xl font-black text-slate-900 dark:text-emerald-400">₹{totalSpend.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-500 mt-2">Across all recorded campaigns</p>
              </div>
              <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-500" /> Top Platform
                </h3>
                <p className="text-4xl font-black text-slate-900 dark:text-blue-400 truncate capitalize">{topPlatform}</p>
                <p className="text-xs text-slate-500 mt-2">{topPlatformPercent}% of your campaigns</p>
              </div>
              <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-500" /> Average Spend
                </h3>
                <p className="text-4xl font-black text-slate-900 dark:text-amber-400">₹{avgSpend.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-500 mt-2">Per influencer</p>
              </div>
            </div>

            <div className="h-96 w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 shadow-sm">
              <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-400">Performance Over Time</h2>
              <p className="text-slate-500 dark:text-slate-600 mt-2">Connect your tracking links to populate real-time charts.</p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
