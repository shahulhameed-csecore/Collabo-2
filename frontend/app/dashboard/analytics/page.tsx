'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { 
  BarChart3, Target, Plus, Smartphone, 
  Zap, ArrowUpRight, ArrowDownRight, Lightbulb, Calendar as CalendarIcon, MousePointerClick, Download
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { getCampaigns, getApiErrorMessage } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const AnalyticsChart = dynamic(() => import('@/components/AnalyticsChart'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400">Loading chart...</div>
});

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await getCampaigns(200); // Fetch max allowed batch for analytics
        setCampaigns(data.data);
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to load campaigns'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // --- Real Data Processing & Insights ---
  const { 
    totalSpend, 
    totalClicks, 
    costPerClick, 
    hasGoodROI, 
    topPlatform, 
    topPlatformPercent,
    chartData,
    peakDay,
    avgROI
  } = useMemo(() => {
    if (campaigns.length === 0) {
      return { 
        totalSpend: 0, totalClicks: 0, costPerClick: '0.00', hasGoodROI: false, 
        topPlatform: 'None yet', topPlatformPercent: 0, chartData: [], peakDay: 'N/A', avgROI: '0' 
      };
    }

    
    const tSpend = campaigns.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
    const tClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    
    const cpc = tClicks > 0 ? (tSpend / tClicks).toFixed(2) : '0.00';
    const goodROI = tClicks > 0 && (tSpend / tClicks) <= 15; // Defining < ₹15 as "Good"

    // Top Platform
    const platforms = campaigns.map(c => c.platform).filter(Boolean) as string[];
    const platformCounts = platforms.reduce((acc, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let tPlatform = 'None yet';
    let tPlatformPercent = 0;
    if (platforms.length > 0) {
      const top = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];
      tPlatform = top[0];
      tPlatformPercent = Math.round((top[1] / platforms.length) * 100);
    }

    // Generate Chart Data for the last 30 days
    const daysMap: Record<string, { clicks: number; spend: number; weekday: number }> = {};
    const now = new Date();
    
    // Initialize last 30 days to 0 to ensure continuous graph
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap[dateStr] = { clicks: 0, spend: 0, weekday: d.getDay() };
    }

    // Populate with real data based on created_at (or updated_at if clicks happen later)
    campaigns.forEach(c => {
      if (!c.created_at) return;
      const d = new Date(c.created_at);
      
      // Only include if it happened within the last 30 days
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays <= 30) {
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (daysMap[dateStr]) {
          daysMap[dateStr].clicks += (c.clicks || 0);
          daysMap[dateStr].spend += (c.payment_amount || 0);
        }
      }
    });

    const cData = Object.entries(daysMap).map(([date, data]) => ({
      date,
      clicks: data.clicks,
      spend: data.spend,
      weekday: data.weekday
    }));

    // Find Peak Day of the week for clicks
    const weekdayClicks = new Array(7).fill(0);
    cData.forEach(d => {
      weekdayClicks[d.weekday] += d.clicks;
    });
    
    let maxClicks = 0;
    let peakDayIdx = -1;
    weekdayClicks.forEach((clicks, idx) => {
      if (clicks > maxClicks) {
        maxClicks = clicks;
        peakDayIdx = idx;
      }
    });
    const daysOfWeek = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const pDay = peakDayIdx !== -1 ? daysOfWeek[peakDayIdx] : 'N/A';

    // Average ROI (Clicks per ₹1000 spent)
    const aROI = tSpend > 0 ? Math.round((tClicks / tSpend) * 1000).toLocaleString('en-IN') : '0';

    return { 
      totalSpend: tSpend, 
      totalClicks: tClicks, 
      costPerClick: cpc, 
      hasGoodROI: goodROI, 
      topPlatform: tPlatform, 
      topPlatformPercent: tPlatformPercent,
      chartData: cData,
      peakDay: pDay,
      avgROI: aROI
    };
  }, [campaigns]);

  const handleExportCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const headers = ['Date', 'Clicks', 'Spend (INR)', 'Daily ROI (Clicks per 1000 INR)'];
    const csvRows = [headers.join(',')];
    chartData.forEach(row => {
      const dailyROI = row.spend > 0 ? (row.clicks / row.spend) * 1000 : 0;
      csvRows.push([row.date, row.clicks, row.spend, dailyROI.toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabo_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported to CSV');
  };

  const isEmpty = !isLoading && campaigns.length === 0;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <BarChart3 className="w-6 h-6 text-emerald-500" />
              Campaign Analytics
            </h1>
            <p className="text-slate-500 mt-1">Track your ROI and measure creator performance in real-time.</p>
          </div>
          {!isEmpty && (
            <div className="hidden sm:flex items-center gap-3 relative">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Tracking Active
              </span>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg px-4 py-1.5 text-xs transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
            <div className="h-96 md:col-span-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          </div>
        ) : isEmpty ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-3xl text-center shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
            <div className="relative z-10">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 dark:border-emerald-500/20 shadow-inner rotate-3">
                <BarChart3 className="w-10 h-10 text-emerald-500 -rotate-3" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Unlock Your Data</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
                Stop guessing what works. Create a campaign, add a tracking link, and watch your clicks, spend, and ROI update in beautiful, real-time charts.
              </p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl px-6 py-3 text-sm transition-all shadow-xl shadow-emerald-500/25 active:scale-95 group">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" /> 
                Create First Campaign
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* AI Insights Bar */}
            {totalClicks > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 mb-1">AI Performance Insights</h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-500/80">
                    Your campaigns generate an average of <strong>{avgROI} clicks per ₹1,000 spent</strong>. 
                    Historically, you see peak engagement on <strong>{peakDay}</strong>. Consider aligning future deadlines with this trend.
                  </p>
                </div>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <Target className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Total Spend
                </h3>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">₹{totalSpend.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors pointer-events-none translate-x-8 -translate-y-8" />
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide relative">
                  <MousePointerClick className="w-4 h-4 text-purple-500" /> Total Clicks
                </h3>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight relative">{totalClicks.toLocaleString('en-IN')}</p>
                {totalClicks > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 w-fit px-2 py-1 rounded-md relative uppercase tracking-wider">
                    <ArrowUpRight className="w-3.5 h-3.5" /> High Engagement
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <Zap className="w-4 h-4 text-amber-500" /> Cost Per Click
                </h3>
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">₹{costPerClick}</p>
                {totalClicks > 0 && (
                  <div className={`mt-3 flex items-center gap-1.5 text-[10px] font-bold w-fit px-2 py-1 rounded-md uppercase tracking-wider ${hasGoodROI ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10'}`}>
                    {hasGoodROI ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />} 
                    {hasGoodROI ? 'Excellent ROI' : 'Needs Optimization'}
                  </div>
                )}
              </div>
              
              <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                  <Smartphone className="w-4 h-4 text-blue-500" /> Top Platform
                </h3>
                <p className="text-3xl font-black text-slate-900 dark:text-white truncate capitalize tracking-tight">{topPlatform}</p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 w-fit px-2 py-1 rounded-md uppercase tracking-wider">
                  {topPlatformPercent}% of volume
                </div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-5 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-emerald-500" /> Performance Over Time
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">30-day view of clicks vs spend based on campaign creation dates.</p>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                    <span className="text-slate-700 dark:text-slate-300">Clicks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                    <span className="text-slate-700 dark:text-slate-300">Spend (₹)</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] sm:h-[400px] w-full">
                <AnalyticsChart data={chartData} />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
