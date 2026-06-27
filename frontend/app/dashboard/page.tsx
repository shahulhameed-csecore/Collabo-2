'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import EditCampaignModal from '@/components/EditCampaignModal';
import dynamic from 'next/dynamic';
import { getCampaigns, computeDashboardStats, getApiErrorMessage } from '@/lib/api';

const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false });
import type { Campaign, DashboardStats } from '@/lib/types';
import {
  Plus, RefreshCw, TrendingUp, Users, Clock,
  DollarSign, AlertCircle, Calendar,
  Zap, CheckCircle2, BarChart2,
  FileText, Table as TableIcon, Download, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, trend, id,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
  trend?: { value: string; positive: boolean };
  id?: string;
}) {
  const accentMap = {
    emerald: {
      bg: 'bg-emerald-500/12', text: 'text-emerald-400',
      border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/35 hover:shadow-emerald-500/12',
      iconBg: 'bg-emerald-500/12 border-emerald-500/20',
      blob: 'bg-emerald-400/20',
    },
    amber: {
      bg: 'bg-amber-500/12', text: 'text-amber-400',
      border: 'border-amber-500/20', hover: 'hover:border-amber-500/35 hover:shadow-amber-500/12',
      iconBg: 'bg-amber-500/12 border-amber-500/20',
      blob: 'bg-amber-400/18',
    },
    rose: {
      bg: 'bg-rose-500/12', text: 'text-rose-400',
      border: 'border-rose-500/20', hover: 'hover:border-rose-500/35 hover:shadow-rose-500/12',
      iconBg: 'bg-rose-500/12 border-rose-500/20',
      blob: 'bg-rose-400/18',
    },
    slate: {
      bg: 'bg-slate-700/40', text: 'text-slate-300',
      border: 'border-slate-700/40', hover: 'hover:border-slate-600/50 hover:shadow-slate-500/8',
      iconBg: 'bg-slate-700/40 border-slate-700/40',
      blob: 'bg-slate-500/15',
    },
    blue: {
      bg: 'bg-blue-500/12', text: 'text-blue-400',
      border: 'border-blue-500/20', hover: 'hover:border-blue-500/35 hover:shadow-blue-500/12',
      iconBg: 'bg-blue-500/12 border-blue-500/20',
      blob: 'bg-blue-400/18',
    },
  };
  const a = accentMap[accent];
  return (
    <div
      id={id}
      className={`
        relative bg-white dark:bg-slate-900/60 border ${a.border} ${a.hover}
        rounded-2xl p-5 overflow-hidden transition-all duration-250
        hover:shadow-xl hover:-translate-y-0.5 group
        shadow-sm dark:shadow-none
      `}
    >
      {/* Glow blob */}
      <div
        className={`absolute -top-6 -right-6 w-28 h-28 ${a.blob} rounded-full blur-2xl pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 leading-none">
            {label}
          </p>
          <p className={`text-2xl sm:text-3xl font-extrabold ${a.text} leading-none mb-2`}>{value}</p>
          {sub && (
            <p className="text-[11px] text-slate-400 dark:text-slate-600 leading-relaxed mt-1 truncate">{sub}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2.5 text-xs font-bold ${trend.positive ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              <TrendingUp className={`w-3 h-3 ${!trend.positive ? 'rotate-180' : ''}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl border flex-shrink-0 ${a.iconBg} group-hover:scale-110 transition-transform duration-200`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${a.text}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Stat Card ───────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm dark:shadow-none">
      <div className="skeleton h-2.5 w-20 rounded mb-4" />
      <div className="skeleton h-8 w-16 rounded mb-2" />
      <div className="skeleton h-2.5 w-24 rounded" />
    </div>
  );
}

// ─── Upcoming Deadline Item ───────────────────────────────────────────────────
function DeadlineItem({ campaign }: { campaign: Campaign }) {
  const deadline = new Date(campaign.deadline!);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = daysLeft < 0;
  const urgent  = daysLeft >= 0 && daysLeft <= 2;
  const today   = daysLeft === 0;

  const badgeClass = overdue
    ? 'bg-rose-500 text-white'
    : urgent
    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-slate-50 dark:hover:bg-slate-800/30 group cursor-default ${
      overdue ? 'border-rose-500/25 bg-rose-500/5' :
      urgent  ? 'border-amber-500/20 bg-amber-500/4' :
                'border-slate-200 dark:border-slate-800/40 bg-transparent'
    }`}>
      <div className={`flex-shrink-0 p-2 rounded-lg ${
        overdue ? 'bg-rose-500/15' : urgent ? 'bg-amber-500/12' : 'bg-slate-100 dark:bg-slate-800/60'
      }`}>
        <Calendar className={`w-3.5 h-3.5 ${
          overdue ? 'text-rose-400' : urgent ? 'text-amber-400' : 'text-slate-400'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {campaign.influencer_name ?? campaign.influencer_handle}
        </p>
        <p className="text-xs text-slate-500 truncate">{campaign.deliverables ?? 'No deliverables set'}</p>
      </div>
      <div className="flex-shrink-0 text-right space-y-1">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {overdue ? `${Math.abs(daysLeft)}d overdue` : today ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
        </span>
        <p className="text-[10px] text-slate-500 text-right">
          {deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </p>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const fetchCampaigns = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const data = await getCampaigns();
      setCampaigns(data);
      setStats(computeDashboardStats(data));
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to load campaigns.');
      if (!silent) setError(msg);
      else toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const loadSampleData = () => {
    const sampleCampaigns: Campaign[] = [
      {
        id: 'sample-1',
        user_id: 'sample-user',
        influencer_name: 'Sample: Riya Sharma',
        influencer_handle: '@riya_creates',
        platform: 'Instagram',
        deliverables: '1 Reel + 2 Stories',
        payment_amount: 15000,
        deadline: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
        status: 'active',
        special_notes: null,
        magic_link_token: null,
        proof_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'sample-2',
        user_id: 'sample-user',
        influencer_name: 'Sample: Tech Guru',
        influencer_handle: '@techguru_in',
        platform: 'YouTube',
        deliverables: 'Dedicated Integration (60s)',
        payment_amount: 45000,
        deadline: new Date(Date.now() - 86400000).toISOString(), // Overdue 1 day
        status: 'active',
        special_notes: null,
        magic_link_token: null,
        proof_url: null,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'sample-3',
        user_id: 'sample-user',
        influencer_name: 'Sample: Style with Sneha',
        influencer_handle: '@sneha.styles',
        platform: 'Instagram',
        deliverables: '1 Carousel Post',
        payment_amount: 0,
        deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
        status: 'content_received',
        special_notes: 'Barter deal',
        magic_link_token: null,
        proof_url: 'https://instagram.com/p/sample',
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      }
    ];
    const newCampaigns = [...campaigns, ...sampleCampaigns];
    setCampaigns(newCampaigns);
    setStats(computeDashboardStats(newCampaigns));
    toast.success('Sample data loaded! Feel free to explore.');
  };

  const clearSampleData = () => {
    const newCampaigns = campaigns.filter(c => !c.influencer_name?.includes('Sample:'));
    setCampaigns(newCampaigns);
    setStats(computeDashboardStats(newCampaigns));
    toast.success('Sample data cleared!');
  };

  const handleDownload = async (format: 'pdf' | 'excel') => {
    try {
      setIsDownloading(true);
      setShowDownloadMenu(false);
      // Format current month as YYYY-MM
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const { downloadReport } = await import('@/lib/api');
      await downloadReport(monthStr, format);
      toast.success(`${format.toUpperCase()} report downloaded!`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download report'));
    } finally {
      setIsDownloading(false);
    }
  };

  const isFirstTime = !isLoading && campaigns.length === 0 && !error;

  return (
    <DashboardLayout onNewCampaign={() => setIsModalOpen(true)}>
      <OnboardingTour />
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Campaign Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-0.5">
            {isLoading
              ? 'Loading your campaigns...'
              : campaigns.length === 0
              ? 'No campaigns yet — create your first one!'
              : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} tracked`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download Report Button */}
          {!isFirstTime && (
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={isDownloading || isLoading}
                className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white font-semibold rounded-xl px-3.5 py-2.5 text-sm transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Download className="w-4 h-4 text-emerald-400" />
                )}
                <span className="hidden sm:inline">Report</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </button>
              
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50 animate-fade-in">
                  <button
                    onClick={() => handleDownload('pdf')}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-rose-400" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <TableIcon className="w-4 h-4 text-emerald-400" />
                    Download Excel
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button
            id="refresh-btn"
            onClick={() => fetchCampaigns(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white font-semibold rounded-xl px-3.5 py-2.5 text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            id="new-campaign-header-btn"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-white font-bold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/8 border border-rose-500/20 rounded-xl mb-6 animate-slide-down">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
            <p className="text-xs text-slate-500 mt-0.5">Check your internet connection or try refreshing.</p>
          </div>
          <button
            onClick={() => fetchCampaigns()}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── First-time welcome ── */}
      {isFirstTime && (
        <div className="mb-6 relative overflow-hidden rounded-3xl border border-emerald-500/20 animate-fade-in">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-teal-500/4 to-transparent" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-teal-500/6 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="p-3.5 bg-gradient-to-br from-emerald-500/25 to-teal-500/15 rounded-2xl border border-emerald-500/30 flex-shrink-0 animate-float shadow-lg shadow-emerald-500/15">
                  <Zap className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-1.5 tracking-tight">Welcome to Collabo! 👋</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                    Track every influencer deal in one place. Create campaigns, upload DMs,
                    and build your ultimate creator CRM. Let's make influencer marketing effortless.
                  </p>
                  {/* Quick tips */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['Set deadlines', 'Track payments', 'Auto-reminders'].map(tip => (
                      <span key={tip} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {tip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl px-5 sm:px-6 py-3 sm:py-3.5 text-sm transition-all shadow-xl shadow-emerald-500/25 active:scale-[0.98] whitespace-nowrap hover:shadow-emerald-500/40"
              >
                <Plus className="w-4 h-4" />
                Create First Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard
              id="stat-total"
              label="Total Campaigns"
              value={String(stats.total)}
              sub={`${stats.completed} paid · ${stats.cancelled} cancelled`}
              icon={Users}
              accent="slate"
            />
            <StatCard
              id="stat-active"
              label="Active Now"
              value={String(stats.active)}
              sub={stats.upcomingDeadlines.length > 0 ? `${stats.upcomingDeadlines.length} due this week` : 'No upcoming deadlines'}
              icon={TrendingUp}
              accent="emerald"
              trend={stats.active > 0 ? { value: 'In progress', positive: true } : undefined}
            />
            <StatCard
              id="stat-overdue"
              label="Overdue"
              value={String(stats.overdue)}
              sub={stats.overdue > 0 ? 'Action required' : 'All on track 🎉'}
              icon={stats.overdue > 0 ? AlertCircle : CheckCircle2}
              accent={stats.overdue > 0 ? 'rose' : 'emerald'}
            />
            <StatCard
              id="stat-spend"
              label="Pending Spend"
              value={`₹${(stats.pendingSpend / 1000).toFixed(0)}K`}
              sub={`₹${(stats.totalSpend / 1000).toFixed(0)}K total budget`}
              icon={DollarSign}
              accent="amber"
            />
          </>
        ) : null}
      </div>

      {/* ── Main Content: Table + Sidebar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Campaign Table */}
        <div className="xl:col-span-2 bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">All Campaigns</h2>
              {!isLoading && (
                <span className="text-xs text-slate-600 font-medium">({campaigns.length})</span>
              )}
            </div>
            {!isLoading && campaigns.length > 0 && (
              <button
                id="table-add-btn"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors hover:bg-emerald-500/10 px-2 py-1 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            )}
          </div>
          <div className="p-4">
            <CampaignTable
              campaigns={campaigns}
              isLoading={isLoading}
              onRefresh={() => fetchCampaigns(true)}
              onCreateNew={() => setIsModalOpen(true)}
              onEdit={setEditingCampaign}
              onLoadSampleData={loadSampleData}
              onClearSampleData={clearSampleData}
            />
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-4">
          {/* Upcoming Deadlines */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/40">
              <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Deadlines</h3>
              {stats && stats.upcomingDeadlines.length > 0 && (
                <span className="ml-auto text-xs font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                  {stats.upcomingDeadlines.length}
                </span>
              )}
            </div>
            <div className="p-3 space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 rounded w-3/4" />
                      <div className="skeleton h-2.5 rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : stats && stats.upcomingDeadlines.length > 0 ? (
                stats.upcomingDeadlines.map(c => (
                  <DeadlineItem key={c.id} campaign={c} />
                ))
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl mb-3 border border-slate-100 dark:border-slate-700/30">
                    <Calendar className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-500 font-semibold">No deadlines this week</p>
                  <p className="text-xs text-slate-500 dark:text-slate-600 mt-0.5">You're all clear 🎉</p>
                </div>
              )}
            </div>
          </div>

          {/* Performance Card */}
          {!isLoading && stats && stats.total > 0 && (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/40">
                <BarChart2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Performance</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Success Rate */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500 font-medium">Success Rate</span>
                    <span className={`text-sm font-extrabold ${
                      stats.successRate >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                      : stats.successRate >= 40 ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'}`}>
                      {stats.successRate}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        stats.successRate >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : stats.successRate >= 40 ? 'bg-amber-500'
                        : 'bg-rose-500'}`}
                      style={{ width: `${stats.successRate}%` }}
                    />
                  </div>
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Draft',     value: campaigns.filter(c => c.status === 'draft').length,     color: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-400' },
                    { label: 'Active',    value: stats.active,                                            color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-400' },
                    { label: 'In Review', value: campaigns.filter(c => c.status === 'content_received').length, color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-400' },
                    { label: 'Approved',  value: campaigns.filter(c => c.status === 'approved').length, color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-400' },
                    { label: 'Paid',      value: stats.completed,                                         color: 'text-slate-600 dark:text-slate-400',   dot: 'bg-slate-400' },
                    { label: 'Cancelled', value: stats.cancelled,                                         color: 'text-rose-600 dark:text-rose-400',    dot: 'bg-rose-400' },
                  ].map(({ label, value, color, dot }) => (
                    <div key={label} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/20">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                        <span className="text-xs text-slate-500 dark:text-slate-500">{label}</span>
                      </div>
                      <span className={`text-sm font-extrabold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Average payment */}
                {stats.avgPayment > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/15 rounded-xl">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-500">Avg. Payment</span>
                    </div>
                    <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                      ₹{stats.avgPayment.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips card for new users */}
          {!isLoading && campaigns.length === 0 && (
            <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900/60 dark:to-slate-800/40 border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">💡 Quick Tips</h3>
              <ul className="space-y-2.5">
                {[
                  'Set deadlines to track overdue campaigns instantly',
                  'Use the status dropdown to track campaign progress',
                  'Toggle "Launch immediately" to skip Draft and go Active',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchCampaigns(true)}
      />

      {/* Edit Campaign Modal */}
      <EditCampaignModal
        campaign={editingCampaign}
        isOpen={!!editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSuccess={() => {
          fetchCampaigns(true);
          setEditingCampaign(null);
        }}
      />
    </DashboardLayout>
  );
}
