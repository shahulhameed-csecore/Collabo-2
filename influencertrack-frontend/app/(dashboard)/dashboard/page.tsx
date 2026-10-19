'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import CampaignTable from '@/components/CampaignTable';
import CreateCampaignModal from '@/components/CreateCampaignModal';
import EditCampaignModal from '@/components/EditCampaignModal';
import { useCampaignModal } from '@/contexts/CampaignModalContext';

import { getCampaigns, computeDashboardStats, getApiErrorMessage, loadSampleDataApi } from '@/lib/api';

import type { Campaign, DashboardStats } from '@/lib/types';
import {
  Plus, RefreshCw, Clock,
  AlertCircle, Calendar,
  Zap, CheckCircle2,
  FileText, Table as TableIcon, Download, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Linear / Attio Architectural Metric Card ────────────────────────────────
function ArchitecturalMetricCard({
  id,
  label,
  value,
  sub,
  statusDot,
}: {
  id?: string;
  label: string;
  value: string;
  sub?: string;
  statusDot?: 'emerald' | 'amber' | 'rose' | 'slate' | 'pulse-emerald';
}) {
  const dotClasses = {
    'emerald': 'bg-emerald-400',
    'pulse-emerald': 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    'amber': 'bg-amber-400',
    'rose': 'bg-rose-400',
    'slate': 'bg-slate-500',
  };

  return (
    <div
      id={id}
      className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-5 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors flex flex-col justify-between"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase font-sans">
          {label}
        </span>
        {statusDot && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClasses[statusDot]}`} />
        )}
      </div>

      <div className="my-1">
        <span className="font-mono tabular-nums text-3xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none block">
          {value}
        </span>
      </div>

      {sub && (
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-2 truncate">
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Skeleton Metric Card ─────────────────────────────────────────────────────
function MetricCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-5 animate-pulse flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-20 rounded bg-slate-200 dark:bg-white/[0.06]" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.06]" />
      </div>
      <div className="h-8 w-24 rounded bg-slate-200 dark:bg-white/[0.06] mb-3" />
      <div className="h-3 w-32 rounded bg-slate-200 dark:bg-white/[0.06]" />
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isModalOpen, openModal, closeModal } = useCampaignModal();
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCampaigns = useCallback(async (silent = false, pageNum = 1) => {
    if (!silent && pageNum === 1) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const limit = 50;
      const offset = (pageNum - 1) * limit;
      const data = await getCampaigns(limit, offset);
      const items = Array.isArray(data?.data) ? data.data : Array.isArray((data as any)?.campaigns) ? (data as any).campaigns : [];
      setCampaigns(prev => {
        const newData = pageNum === 1 ? items : [...prev, ...items];
        setStats(computeDashboardStats(newData));
        return newData;
      });
      setHasMore(items.length === limit);
      setTotalCount(data?.count ?? items.length);
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

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchCampaigns(true, next);
  };

  const loadSampleData = async () => {
    try {
      setIsLoading(true);
      await loadSampleDataApi();
      toast.success('Sample data loaded! Feel free to explore.');
      setPage(1);
      await fetchCampaigns(true, 1);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load sample data.'));
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'excel') => {
    try {
      setIsDownloading(true);
      setShowDownloadMenu(false);
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

  // Compute urgent & upcoming deadlines (Next 7 days + overdue)
  const urgentDeadlines = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return campaigns
      .filter(c => {
        if (!c.deadline || c.status === 'paid' || c.status === 'cancelled') return false;
        const d = new Date(c.deadline);
        return d <= sevenDays;
      })
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }, [campaigns]);

  return (
    <div className="w-full max-w-[1500px] mx-auto select-none">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Campaign Command Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5 font-normal">
            Track deliverables, deadlines, and payouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Report Button */}
          {!isFirstTime && (
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={isDownloading || isLoading}
                className="flex items-center gap-1.5 bg-white dark:bg-[#0A0E17] hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-50"
              >
                {isDownloading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Report</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
              
              {showDownloadMenu && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
                  <button
                    onClick={() => handleDownload('pdf')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center gap-2 transition-colors"
                  >
                    <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
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
            className="flex items-center gap-1.5 bg-white dark:bg-[#0A0E17] hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Primary Header CTA */}
          <button
            id="new-campaign-header-btn"
            onClick={openModal}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-[#05070B] font-semibold rounded-lg px-3.5 py-2 text-xs transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl mb-6 animate-slide-down">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-rose-400">{error}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Check network connectivity or retry synchronization.</p>
          </div>
          <button
            onClick={() => fetchCampaigns()}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── First-time Welcome Banner ── */}
      {isFirstTime && (
        <div className="mb-6 relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0A0E17] p-6 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1 tracking-tight">Welcome to Collabo Engine</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                  Track every creator deliverable, deadline, and payout in one unified command center.
                  Forward negotiation chats or voice notes to auto-extract campaigns instantly.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Automated reminders', 'Monospace financial audit', '1-click creator magic links'].map(tip => (
                    <span key={tip} className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              id="tour-first-campaign-btn"
              onClick={openModal}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] font-semibold rounded-lg px-4 py-2.5 text-xs transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Campaign
            </button>
          </div>
        </div>
      )}

      {/* ── Architectural 4-Metric Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <ArchitecturalMetricCard
              id="stat-total"
              label="Total Campaigns"
              value={String(stats.total)}
              sub={`${stats.completed} paid · ${stats.cancelled} cancelled`}
              statusDot="slate"
            />
            <ArchitecturalMetricCard
              id="stat-active"
              label="Active Pipeline"
              value={String(stats.active)}
              sub={stats.upcomingDeadlines.length > 0 ? `${stats.upcomingDeadlines.length} due this week` : 'No upcoming deadlines'}
              statusDot={stats.active > 0 ? 'pulse-emerald' : 'slate'}
            />
            <ArchitecturalMetricCard
              id="stat-overdue"
              label="Overdue / Due Soon"
              value={String(stats.overdue)}
              sub={stats.overdue > 0 ? `${stats.overdue} require immediate action` : 'All deadlines on track'}
              statusDot={stats.overdue > 0 ? 'rose' : 'emerald'}
            />
            <ArchitecturalMetricCard
              id="stat-spend"
              label="Pending Spend"
              value={`₹${stats.pendingSpend.toLocaleString('en-IN')}`}
              sub={`₹${stats.totalSpend.toLocaleString('en-IN')} total committed`}
              statusDot="amber"
            />
          </>
        ) : null}
      </div>

      {/* ── 2-Card Horizontal Command Strip (Deadlines + Pipeline Health) ── */}
      {!isLoading && stats && stats.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
          {/* Card A: Urgent & Upcoming Deadlines (Next 7 Days) */}
          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-3.5 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase font-sans">
                  Upcoming Deadlines (Next 7 Days)
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                {urgentDeadlines.length} scheduled
              </span>
            </div>

            <div className="min-h-[46px] flex items-center">
              {urgentDeadlines.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full">
                  {urgentDeadlines.map(c => {
                    const deadline = new Date(c.deadline!);
                    const now = new Date();
                    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysLeft < 0;
                    const isToday = daysLeft === 0;

                    return (
                      <div
                        key={c.id}
                        className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.07] text-xs hover:border-slate-300 dark:hover:border-white/[0.14] transition-colors"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {c.influencer_name || c.influencer_handle}
                        </span>
                        <span className="text-slate-300 dark:text-white/20 text-[10px]">•</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[120px]">
                          {c.deliverables || 'Deliverable'}
                        </span>
                        <span className="text-slate-300 dark:text-white/20 text-[10px]">•</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {deadline.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            isOverdue
                              ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30'
                              : isToday
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]'
                          }`}
                        >
                          {isOverdue ? `${Math.abs(daysLeft)}d overdue` : isToday ? 'Today' : `${daysLeft}d left`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-sans py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>All deadlines on track — no urgent deliverables pending.</span>
                </div>
              )}
            </div>
          </div>

          {/* Card B: Pipeline Health & Quick Breakdown */}
          <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-xl p-3.5 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase font-sans">
                Pipeline Health
              </span>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">
                  Success: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.successRate}%</span>
                </span>
                {stats.avgPayment > 0 && (
                  <span className="text-slate-500 dark:text-slate-400">
                    Avg: <span className="text-slate-800 dark:text-slate-200 font-semibold">₹{stats.avgPayment.toLocaleString('en-IN')}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden my-2">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>

            {/* Mini Horizontal Status Breakdown */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 overflow-x-auto no-scrollbar pt-0.5">
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-slate-800 dark:text-slate-200">{stats.completed}</span> Paid
              </span>
              <span className="text-slate-300 dark:text-white/20">•</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                <span className="text-slate-800 dark:text-slate-200">{campaigns.filter(c => c.status === 'approved').length}</span> Approved
              </span>
              <span className="text-slate-300 dark:text-white/20">•</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-slate-200">{stats.active}</span> Active
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-slate-200">{campaigns.filter(c => c.status === 'content_received').length}</span> In Review
              </span>
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-slate-200">{campaigns.filter(c => c.status === 'draft').length}</span> Draft
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 100% Full-Width Campaign Table Card Container ── */}
      <div className="w-full bg-[#0A0E17] border border-white/[0.07] rounded-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
        {/* Table Card Header (Zero redundant "+ Add" button) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white tracking-tight">All Campaigns</h2>
            {!isLoading && (
              <span className="text-xs text-slate-400 font-mono">({campaigns.length})</span>
            )}
          </div>
        </div>

        {/* Full-width table */}
        <div className="p-4">
          <CampaignTable
            campaigns={campaigns}
            isLoading={isLoading}
            onRefresh={() => fetchCampaigns(true, 1)}
            onCreateNew={openModal}
            onEdit={setEditingCampaign}
            onLoadSampleData={loadSampleData}
            onOptimisticUpdate={(id, updates) => setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))}
            onOptimisticDelete={(id) => setCampaigns(prev => prev.filter(c => c.id !== id))}
          />

          {hasMore && !isLoading && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={loadMore}
                disabled={isRefreshing}
                className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-lg text-xs font-mono transition-colors flex items-center gap-2 border border-white/[0.08]"
              >
                {isRefreshing && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
                <span>{isRefreshing ? 'Loading batch...' : 'Load More Campaigns'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={closeModal}
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
    </div>
  );
}
