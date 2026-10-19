'use client';

import { 
  BarChart3, Target, Plus, Smartphone, 
  Zap, ArrowUpRight, ArrowDownRight, Calendar as CalendarIcon, MousePointerClick, Download,
  Sparkles, Award
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getCampaigns, getApiErrorMessage } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { PlatformIcon } from '@/components/PlatformIcon';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const AnalyticsChart = dynamic(() => import('@/components/AnalyticsChart'), { 
  ssr: false, 
  loading: () => (
    <div className="h-full w-full bg-[#05070B] rounded-xl border border-white/[0.06] animate-pulse flex items-center justify-center text-slate-500 font-mono text-xs">
      Loading attribution timeline...
    </div>
  )
});

type Timeframe = '30D' | '90D' | 'All Time';

// ── Currency and Date Formatting Helpers ─────────────────────────────────────
function formatINR(val: number): string {
  if (isNaN(val) || val === 0) return '₹0';
  if (val < 100) {
    return `₹${val.toFixed(2)}`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCampaignDate(c: Campaign): Date | null {
  const dStr = c.deadline || c.created_at;
  if (!dStr) return null;
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
}

function normalizePlatformName(raw?: string | null): string {
  if (!raw) return 'Other';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('youtube') || lower === 'yt') return 'YouTube';
  if (lower.includes('instagram') || lower === 'ig' || lower.includes('reel')) return 'Instagram';
  if (lower.includes('tiktok')) return 'TikTok';
  if (lower.includes('twitter') || lower.includes('x.com')) return 'Twitter/X';
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('pinterest')) return 'Pinterest';
  if (lower.includes('snapchat')) return 'Snapchat';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe | null>(null);

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

  // ─── Real Data Processing & Insights ───────────────────────────────────────
  const { 
    totalSpend, 
    totalClicks, 
    costPerClickNum,
    activeOrPaidCount,
    topPlatform, 
    topPlatformPercent,
    chartData,
    peakDay,
    velocitySnippet,
    insightBannerText,
    activeTimeframe,
    platformStats,
    topCampaigns
  } = useMemo(() => {
    if (campaigns.length === 0) {
      return { 
        totalSpend: 0, 
        totalClicks: 0, 
        costPerClickNum: 0, 
        activeOrPaidCount: 0,
        topPlatform: 'None yet', 
        topPlatformPercent: 0, 
        chartData: [], 
        peakDay: null, 
        velocitySnippet: '0 clicks per ₹1,000 spent',
        insightBannerText: 'No campaign analytics available yet. Launch campaigns with creator shortlinks to track real-time velocity.',
        activeTimeframe: 'All Time' as Timeframe,
        platformStats: [],
        topCampaigns: []
      };
    }

    // 1. Spend & Clicks Accounting
    const launchedCampaigns = campaigns.filter(c => (c.clicks || 0) > 0 || c.status === 'paid' || c.status === 'active');
    const tSpend = launchedCampaigns.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
    const tClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const numCpc = tClicks > 0 ? (tSpend / tClicks) : 0;
    const actOrPaid = campaigns.filter(c => c.status === 'active' || c.status === 'paid' || (c.clicks || 0) > 0).length;

    // 2. Top Platform
    const platformMap: Record<string, number> = {};
    campaigns.forEach(c => {
      const p = normalizePlatformName(c.platform);
      platformMap[p] = (platformMap[p] || 0) + 1;
    });
    
    let tPlatform = 'None yet';
    let tPlatformPercent = 0;
    const pEntries = Object.entries(platformMap).sort((a, b) => b[1] - a[1]);
    if (pEntries.length > 0) {
      tPlatform = pEntries[0][0];
      tPlatformPercent = Math.round((pEntries[0][1] / campaigns.length) * 100);
    }

    // 3. Peak Day Calculation across all campaigns with clicks
    const daysOfWeek = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const weekdayClicks = new Array(7).fill(0);
    let hasAnyClicks = false;

    campaigns.forEach(c => {
      const clicks = c.clicks || 0;
      if (clicks > 0) {
        const d = getCampaignDate(c);
        if (d) {
          weekdayClicks[d.getDay()] += clicks;
          hasAnyClicks = true;
        }
      }
    });

    let maxWeekdayClicks = 0;
    let peakDayIdx = -1;
    if (hasAnyClicks) {
      weekdayClicks.forEach((clicks, idx) => {
        if (clicks > maxWeekdayClicks) {
          maxWeekdayClicks = clicks;
          peakDayIdx = idx;
        }
      });
    }

    const pDay = (peakDayIdx !== -1 && maxWeekdayClicks > 0) ? daysOfWeek[peakDayIdx] : null;

    // 4. Click Velocity & Smart Banner Insight Text (Never "N/A" or "0 clicks")
    const clicksPer1k = tSpend > 0 ? (tClicks / tSpend) * 1000 : 0;
    let vSnippet = '';
    if (tClicks === 0) {
      vSnippet = '0 clicks per ₹1,000 spent';
    } else if (clicksPer1k >= 1) {
      vSnippet = `${clicksPer1k >= 10 ? Math.round(clicksPer1k).toLocaleString('en-IN') : clicksPer1k.toFixed(1)} clicks per ₹1,000 spent`;
    } else {
      const cpcFormatted = formatINR(Math.round(tSpend / tClicks));
      vSnippet = `${clicksPer1k.toFixed(2)} clicks per ₹1,000 spent (1 click per ${cpcFormatted})`;
    }

    let bannerText = '';
    if (pDay && tClicks > 0) {
      bannerText = `Your campaigns generate an average of ${vSnippet}. Historically, you see peak engagement on ${pDay}. Align future campaign deadlines with this velocity window for maximum creator reach.`;
    } else {
      bannerText = `Your top channel is ${tPlatform} (${tPlatformPercent}% of volume) across ${campaigns.length} campaigns. Share creator tracking shortlinks (/t/...) to unlock day-of-week click velocity.`;
    }

    // 5. Intelligent Timeframe Detection (Avoid dead flat-zero 30D charts)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const spendLast30 = campaigns.filter(c => {
      const d = getCampaignDate(c);
      return d && d >= thirtyDaysAgo && d <= now;
    }).reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    const spendLast90 = campaigns.filter(c => {
      const d = getCampaignDate(c);
      return d && d >= new Date(now.getTime() - 90 * 86400000) && d <= now;
    }).reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    let defaultTf: Timeframe = '30D';
    if (spendLast30 === 0) {
      defaultTf = spendLast90 > 0 ? '90D' : 'All Time';
    }
    const curTimeframe = selectedTimeframe ?? defaultTf;

    // 6. Generate Timeline Data Buckets using (deadline || created_at)
    let startDate: Date;
    let endDate: Date;

    if (curTimeframe === '30D') {
      startDate = new Date(now.getTime() - 29 * 86400000);
      endDate = new Date(now.getTime() + 7 * 86400000); // include next 7 days for scheduled deadlines
    } else if (curTimeframe === '90D') {
      startDate = new Date(now.getTime() - 89 * 86400000);
      endDate = new Date(now.getTime() + 7 * 86400000);
    } else {
      // All Time
      const validDates = campaigns.map(c => getCampaignDate(c)).filter(Boolean) as Date[];
      if (validDates.length === 0) {
        startDate = new Date(now.getTime() - 29 * 86400000);
        endDate = new Date(now);
      } else {
        const times = validDates.map(d => d.getTime());
        const minCampTime = Math.min(...times);
        const maxCampTime = Math.max(...times);
        const oneYearAgo = now.getTime() - 365 * 86400000;
        const ninetyDaysFuture = now.getTime() + 90 * 86400000;

        startDate = new Date(Math.max(minCampTime - 86400000, oneYearAgo));
        endDate = new Date(Math.min(maxCampTime + 86400000, ninetyDaysFuture));
      }
    }

    const daysMap = new Map<string, { date: string; isoDate: string; clicks: number; spend: number; weekday: number }>();
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (cur <= end) {
      const key = formatDateKey(cur);
      daysMap.set(key, {
        date: formatDateLabel(cur),
        isoDate: key,
        clicks: 0,
        spend: 0,
        weekday: cur.getDay()
      });
      cur.setDate(cur.getDate() + 1);
    }

    campaigns.forEach(c => {
      const d = getCampaignDate(c);
      if (!d) return;
      const key = formatDateKey(d);
      if (daysMap.has(key)) {
        const b = daysMap.get(key)!;
        b.clicks += (c.clicks || 0);
        b.spend += (c.payment_amount || 0);
      }
    });

    const cData = Array.from(daysMap.values());

    // 7. Platform Spend & Click Share Breakdown
    const pMap: Record<string, { count: number; spend: number; clicks: number }> = {};
    campaigns.forEach(c => {
      const p = normalizePlatformName(c.platform);
      if (!pMap[p]) pMap[p] = { count: 0, spend: 0, clicks: 0 };
      pMap[p].count += 1;
      pMap[p].spend += (c.payment_amount || 0);
      pMap[p].clicks += (c.clicks || 0);
    });

    const totalSpendAll = Object.values(pMap).reduce((sum, item) => sum + item.spend, 0) || 1;
    const totalClicksAll = Object.values(pMap).reduce((sum, item) => sum + item.clicks, 0);

    const pStats = Object.entries(pMap)
      .map(([platform, data]) => ({
        platform,
        count: data.count,
        spend: data.spend,
        clicks: data.clicks,
        spendShare: Math.round((data.spend / totalSpendAll) * 100),
        clickShare: totalClicksAll > 0 ? Math.round((data.clicks / totalClicksAll) * 100) : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    // 8. Top Performing Campaigns Leaderboard (Ranked by Clicks then Spend efficiency)
    const topCamps = [...campaigns]
      .sort((a, b) => {
        const clicksA = a.clicks || 0;
        const clicksB = b.clicks || 0;
        if (clicksB !== clicksA) return clicksB - clicksA;
        return (b.payment_amount || 0) - (a.payment_amount || 0);
      })
      .slice(0, 5);

    return { 
      totalSpend: tSpend, 
      totalClicks: tClicks, 
      costPerClickNum: numCpc, 
      activeOrPaidCount: actOrPaid,
      topPlatform: tPlatform, 
      topPlatformPercent: tPlatformPercent,
      chartData: cData,
      peakDay: pDay,
      velocitySnippet: vSnippet,
      insightBannerText: bannerText,
      activeTimeframe: curTimeframe,
      platformStats: pStats,
      topCampaigns: topCamps
    };
  }, [campaigns, selectedTimeframe]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (campaigns.length === 0) return;
    const headers = ['Influencer Name', 'Handle', 'Platform', 'Status', 'Deadline', 'Payment Amount (INR)', 'Verified Clicks', 'Cost Per Click (INR)'];
    const csvRows = [headers.join(',')];

    campaigns.forEach(c => {
      const cpc = (c.clicks || 0) > 0 ? Math.round((c.payment_amount || 0) / c.clicks).toString() : 'N/A';
      const row = [
        `"${(c.influencer_name || '').replace(/"/g, '""')}"`,
        `"${(c.influencer_handle || '').replace(/"/g, '""')}"`,
        `"${(c.platform || 'Other').replace(/"/g, '""')}"`,
        c.status || '',
        c.deadline || '',
        c.payment_amount || 0,
        c.clicks || 0,
        cpc
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabo_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics CSV export complete');
  }, [campaigns]);

  const isEmpty = !isLoading && campaigns.length === 0;

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-6 select-none animate-fade-in pb-16">
      
      {/* ── 1. Compact Architectural Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Campaign Analytics
          </h1>
          <p className="text-xs text-slate-400 font-sans mt-1 font-normal">
            Campaign spend, link clicks, and ROI.
          </p>
        </div>

        {!isEmpty && (
          <div className="flex items-center gap-3">
            <div className="font-mono text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Live Attribution Active
            </div>

            <button
              onClick={handleExportCSV}
              className="font-mono text-xs text-slate-300 hover:text-white bg-[#0A0E17] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        /* ── Loading Skeletons ── */
        <div className="space-y-6">
          <div className="h-14 bg-[#0A0E17] border border-white/[0.07] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-[#0A0E17] border border-white/[0.07] rounded-xl animate-pulse p-5" />
            ))}
          </div>
          <div className="h-96 bg-[#0A0E17] border border-white/[0.07] rounded-xl animate-pulse" />
        </div>
      ) : isEmpty ? (
        /* ── Architectural Empty State ── */
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-[#0A0E17] border border-white/[0.07] rounded-2xl text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] relative overflow-hidden">
          <div className="w-14 h-14 bg-white/[0.04] border border-white/[0.08] rounded-xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2 tracking-tight">Unlock Campaign Intelligence</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6 text-xs font-mono leading-relaxed">
            Create deals, generate deterministic shortlinks (`/t/...`), and monitor live click velocity and creator cost per click.
          </p>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-medium rounded-lg px-4 py-2 text-xs transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)] active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> 
            Create First Campaign
          </Link>
        </div>
      ) : (
        <>
          {/* ── 2. Refined AI Performance Insights Strip (Sharp Architectural Callout) ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] border-l-2 border-l-emerald-500 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-wider uppercase text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  AI Performance Insight
                </span>
                {peakDay && (
                  <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded">
                    Peak: {peakDay}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {insightBannerText}
              </p>
            </div>

            <div className="font-mono text-[10px] text-slate-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-md flex items-center gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Attribution Engine: Deterministic Shortlinks
            </div>
          </div>

          {/* ── 3. 4-Column Architectural KPI Strip ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: TOTAL SPEND */}
            <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/[0.12] transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-medium tracking-wider text-slate-400 uppercase font-sans flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400" /> Total Spend
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] flex-shrink-0" />
              </div>
              <div className="my-1">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white tracking-tight leading-none block">
                  {formatINR(totalSpend)}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-2 truncate">
                {activeOrPaidCount} active/paid deal{activeOrPaidCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* KPI 2: TOTAL CLICKS */}
            <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/[0.12] transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-medium tracking-wider text-slate-400 uppercase font-sans flex items-center gap-1.5">
                  <MousePointerClick className="w-3.5 h-3.5 text-slate-400" /> Total Clicks
                </span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${totalClicks > 0 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`} />
              </div>
              <div className="my-1">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white tracking-tight leading-none block">
                  {totalClicks.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="mt-2">
                {totalClicks === 0 ? (
                  <span className="text-xs text-slate-400 font-mono">Awaiting traffic</span>
                ) : totalClicks < 20 ? (
                  <span className="text-xs text-amber-400/90 font-mono flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Early traction ({totalClicks} clicks)
                  </span>
                ) : (
                  <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> High velocity
                  </span>
                )}
              </div>
            </div>

            {/* KPI 3: COST PER CLICK */}
            <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/[0.12] transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-medium tracking-wider text-slate-400 uppercase font-sans flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-slate-400" /> Cost Per Click
                </span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${totalClicks > 0 && costPerClickNum <= 50 ? 'bg-emerald-400' : costPerClickNum > 50 ? 'bg-amber-400' : 'bg-slate-500'}`} />
              </div>
              <div className="my-1">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white tracking-tight leading-none block">
                  {formatINR(costPerClickNum)}
                </span>
              </div>
              <div className="mt-2">
                {costPerClickNum === 0 ? (
                  <span className="text-xs text-slate-400 font-mono">No click spend yet</span>
                ) : costPerClickNum <= 50 ? (
                  <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> Optimal CPC
                  </span>
                ) : (
                  <span className="text-xs text-amber-400/90 font-mono flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Avg. {formatINR(costPerClickNum)}/click
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: TOP PLATFORM */}
            <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/[0.12] transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-medium tracking-wider text-slate-400 uppercase font-sans flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Top Platform
                </span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${topPlatform !== 'None yet' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              </div>
              <div className="my-1 flex items-center gap-2.5 truncate">
                <PlatformIcon platform={topPlatform} className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <span className="font-mono text-3xl font-semibold text-white tracking-tight capitalize truncate leading-none">
                  {topPlatform}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-2 truncate">
                {topPlatformPercent}% of volume
              </p>
            </div>

          </div>

          {/* ── 4. Performance Over Time Chart Card ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" /> Performance Over Time
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Clicks velocity and spend attribution timeline.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Timeframe Filter Segmented Control */}
                <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.08]">
                  {(['30D', '90D', 'All Time'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`font-mono text-xs px-3 py-1 rounded-md transition-all cursor-pointer ${
                        activeTimeframe === tf
                          ? 'bg-white/[0.1] text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200 font-medium'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-lg">
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    Clicks
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                    Spend (₹)
                  </div>
                </div>
              </div>
            </div>
            
            <div className="h-[320px] sm:h-[380px] w-full mt-4">
              <AnalyticsChart data={chartData} />
            </div>
          </div>

          {/* ── 5. 2-Column Bottom Breakdown Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Card: Platform Spend & Click Share */}
            <div className="lg:col-span-5 bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" /> Platform Distribution
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Spend and engagement breakdown across channels
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {platformStats.length} channel{platformStats.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-4">
                  {platformStats.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 font-mono text-xs">
                      No platform channels recorded yet.
                    </div>
                  ) : (
                    platformStats.map((item) => (
                      <div key={item.platform} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 flex-shrink-0">
                              <PlatformIcon platform={item.platform} className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-white capitalize block">
                                {item.platform}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.count} deal{item.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-semibold text-white font-mono block">
                              {formatINR(item.spend)}
                            </span>
                            <span className="text-[11px] text-emerald-400/90 font-mono">
                              {item.clicks.toLocaleString('en-IN')} clicks ({item.clickShare}%)
                            </span>
                          </div>
                        </div>

                        {/* Hairline Progress Bar */}
                        <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden mt-1 relative">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" 
                            style={{ width: `${Math.max(item.spendShare, 4)}%` }} 
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                          <span>{item.spendShare}% of budget</span>
                          <span>{item.clickShare}% of click volume</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Card: Top Performing Campaigns Leaderboard */}
            <div className="lg:col-span-7 bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 sm:p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" /> Top Performing Campaigns
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Ranked by click volume and cost efficiency
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Leaderboard
                  </span>
                </div>

                {topCampaigns.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-mono text-xs">
                    No active campaigns to rank yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                          <th className="pb-2.5 font-medium pl-1">Rank</th>
                          <th className="pb-2.5 font-medium">Creator</th>
                          <th className="pb-2.5 font-medium">Channel</th>
                          <th className="pb-2.5 font-medium text-right">Spend</th>
                          <th className="pb-2.5 font-medium text-right">Clicks</th>
                          <th className="pb-2.5 font-medium text-right pr-1">Unit CPC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {topCampaigns.map((c, idx) => {
                          const cpc = (c.clicks || 0) > 0 ? (c.payment_amount || 0) / c.clicks : 0;
                          return (
                            <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 pl-1 font-mono text-xs text-slate-400">
                                #{idx + 1}
                              </td>
                              <td className="py-3 pr-2">
                                <div className="max-w-[150px] sm:max-w-[200px]">
                                  <p className="text-xs font-medium text-white truncate">
                                    {c.influencer_name || c.influencer_handle || 'Creator'}
                                  </p>
                                  <p className="font-mono text-[11px] text-slate-400 truncate">
                                    {c.influencer_handle ? `@${c.influencer_handle.replace(/^@/, '')}` : '—'}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                                  <PlatformIcon platform={c.platform} className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="capitalize">{c.platform || 'Other'}</span>
                                </div>
                              </td>
                              <td className="py-3 text-right font-mono text-xs text-slate-200 tabular-nums">
                                {formatINR(c.payment_amount || 0)}
                              </td>
                              <td className="py-3 text-right font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                                {(c.clicks || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 text-right pr-1 font-mono text-xs text-slate-300 tabular-nums">
                                {c.clicks > 0 ? (
                                  <span>{formatINR(cpc)}</span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Attribution: shortlinks (/t/...)</span>
                <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                  Manage Deals <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
