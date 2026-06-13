'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import { getCampaigns, computeDashboardStats, getApiErrorMessage } from '@/lib/api';
import type { Campaign, DashboardStats } from '@/lib/types';
import {
  Plus, RefreshCw, TrendingUp, Users, Clock,
  DollarSign, AlertCircle, Calendar,
  Zap, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
  trend?: { value: string; positive: boolean };
}) {
  const accentMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   glow: 'shadow-amber-500/10' },
    rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20',    glow: 'shadow-rose-500/10' },
    slate:   { bg: 'bg-slate-700/40',   text: 'text-slate-400',   border: 'border-slate-600/30',   glow: 'shadow-slate-500/5' },
    blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    glow: 'shadow-blue-500/10' },
  };
  const a = accentMap[accent];
  return (
    <div className={`relative bg-slate-900/60 border border-slate-800/50 rounded-2xl p-5 overflow-hidden transition-all hover:border-slate-700/60 hover:shadow-lg ${a.glow}`}>
      {/* Subtle background accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 ${a.bg} rounded-full -translate-y-8 translate-x-8 blur-2xl pointer-events-none`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
          <p className={`text-2xl font-bold ${a.text} leading-none mb-1`}>{value}</p>
          {sub && <p className="text-xs text-slate-600 mt-1.5">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <TrendingUp className={`w-3 h-3 ${!trend.positive ? 'rotate-180' : ''}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${a.bg} border ${a.border} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${a.text}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Stat Card ───────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-5">
      <div className="skeleton h-3 w-20 rounded mb-3" />
      <div className="skeleton h-7 w-16 rounded mb-2" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  );
}

// ─── Upcoming Deadline Item ───────────────────────────────────────────────────
function DeadlineItem({ campaign }: { campaign: Campaign }) {
  const deadline = new Date(campaign.deadline!);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const urgent = daysLeft <= 2;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-slate-800/30 ${urgent ? 'border-rose-500/20 bg-rose-500/5' : 'border-slate-800/40'}`}>
      <div className={`flex-shrink-0 p-2 rounded-lg ${urgent ? 'bg-rose-500/10' : 'bg-slate-800/60'}`}>
        <Calendar className={`w-3.5 h-3.5 ${urgent ? 'text-rose-400' : 'text-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {campaign.influencer_name ?? campaign.influencer_handle}
        </p>
        <p className="text-xs text-slate-500 truncate">{campaign.deliverables ?? 'No deliverables set'}</p>
      </div>
      <div className={`flex-shrink-0 text-right`}>
        <p className={`text-xs font-bold ${urgent ? 'text-rose-400' : 'text-slate-300'}`}>
          {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
        </p>
        <p className="text-[10px] text-slate-600">
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
  const [error, setError] = useState<string | null>(null);

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

  const isFirstTime = !isLoading && campaigns.length === 0 && !error;

  return (
    <DashboardLayout onNewCampaign={() => setIsModalOpen(true)}>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Campaign Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isLoading
              ? 'Loading your campaigns...'
              : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} tracked`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white font-medium rounded-xl px-3.5 py-2.5 text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
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
            <p className="text-sm font-medium text-rose-400">{error}</p>
            <p className="text-xs text-slate-500 mt-0.5">Check your internet connection or try refreshing.</p>
          </div>
          <button
            onClick={() => fetchCampaigns()}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── First-time welcome ── */}
      {isFirstTime && (
        <div className="mb-6 p-5 bg-gradient-to-br from-emerald-500/8 to-teal-500/5 border border-emerald-500/15 rounded-2xl animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/15 rounded-xl border border-emerald-500/20 flex-shrink-0">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white mb-1">Welcome to InfluencerTrack! 👋</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                Track every influencer deal in one place. Upload a DM screenshot and our AI will auto-extract
                the influencer details, deliverables, deadline, and payment — saving you hours every week.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Create your first campaign
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
              label="Total Campaigns"
              value={String(stats.total)}
              sub={`${stats.completed} completed`}
              icon={Users}
              accent="slate"
            />
            <StatCard
              label="Active Now"
              value={String(stats.active)}
              sub={`${stats.upcomingDeadlines.length} due this week`}
              icon={TrendingUp}
              accent="emerald"
            />
            <StatCard
              label="Overdue"
              value={String(stats.overdue)}
              sub={stats.overdue > 0 ? 'Action required' : 'All on track 🎉'}
              icon={stats.overdue > 0 ? AlertCircle : CheckCircle2}
              accent={stats.overdue > 0 ? 'rose' : 'emerald'}
            />
            <StatCard
              label="Pending Payments"
              value={`₹${stats.pendingSpend.toLocaleString('en-IN')}`}
              sub={`₹${stats.totalSpend.toLocaleString('en-IN')} total`}
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
              <h2 className="text-sm font-semibold text-white">All Campaigns</h2>
              {!isLoading && (
                <span className="text-xs text-slate-600 font-normal">({campaigns.length})</span>
              )}
            </div>
            {!isLoading && campaigns.length > 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
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
            />
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-4">
          {/* Upcoming Deadlines */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-800/40">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Upcoming Deadlines</h3>
              {stats && stats.upcomingDeadlines.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
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
                <div className="flex flex-col items-center py-8 text-center">
                  <Calendar className="w-7 h-7 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500 font-medium">No deadlines this week</p>
                  <p className="text-xs text-slate-600 mt-0.5">You're all clear 🎉</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Card */}
          {!isLoading && stats && stats.total > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-800/40">
                <h3 className="text-sm font-semibold text-white">Performance</h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Success Rate */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-500">Success Rate</span>
                    <span className={`text-xs font-bold ${stats.successRate >= 70 ? 'text-emerald-400' : stats.successRate >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {stats.successRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${stats.successRate >= 70 ? 'bg-emerald-500' : stats.successRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${stats.successRate}%` }}
                    />
                  </div>
                </div>
                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-amber-400' },
                    { label: 'Active', value: stats.active, color: 'text-emerald-400' },
                    { label: 'Done', value: stats.completed, color: 'text-slate-400' },
                    { label: 'Cancelled', value: campaigns.filter(c => c.status === 'cancelled').length, color: 'text-rose-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-sm font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tips card for new users */}
          {!isLoading && campaigns.length === 0 && (
            <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/40 border border-slate-700/40 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">💡 Quick Tips</h3>
              <ul className="space-y-2.5">
                {[
                  'Upload a WhatsApp DM screenshot to auto-extract campaign details',
                  'Set deadlines to track overdue campaigns instantly',
                  'Use the status dropdown to track campaign progress',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-400 leading-relaxed">{tip}</span>
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
    </DashboardLayout>
  );
}
