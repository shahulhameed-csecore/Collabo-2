'use client';

import { useState, useMemo } from 'react';
import type { Campaign, CampaignStatus, FilterState } from '@/lib/types';
import { updateCampaignStatus, deleteCampaign, getApiErrorMessage, bulkUpdateStatus, bulkDeleteCampaigns, bulkRemindCampaigns, exportCsvApi } from '@/lib/api';
import {
  ChevronUp, ChevronDown, Trash2,
  Calendar, DollarSign, AlertCircle, CheckCircle2,
  Clock, Search, Filter,
  Globe, X, Check, ExternalLink, Edit2, FileSpreadsheet,
  MessageCircle, Download, CheckSquare, Link as LinkIcon, TrendingUp, Loader2, RotateCcw, Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  onEdit?: (campaign: Campaign) => void;
  onLoadSampleData?: () => void;
  onOptimisticUpdate?: (id: string, updates: Partial<Campaign>) => void;
  onOptimisticDelete?: (id: string) => void;
}

import {
  STATUS_CONFIG,
  STATUS_FILTERS,
  StatusBadge,
  PlatformBadge,
  SkeletonRow,
  EmptyState
} from '@/components/CampaignTableUtils';

export default function CampaignTable({
  campaigns,
  isLoading,
  onRefresh,
  onCreateNew,
  onEdit,
  onLoadSampleData,
  onOptimisticUpdate,
  onOptimisticDelete
}: CampaignTableProps) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: 'all', platform: '' });
  const [sortKey, setSortKey] = useState<keyof Campaign>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [trackingModalCampaign, setTrackingModalCampaign] = useState<Campaign | null>(null);
  const [proofHistoryCampaign, setProofHistoryCampaign] = useState<Campaign | null>(null);

  type FeedbackStep = 'input' | 'share';
  const [feedbackModal, setFeedbackModal] = useState<{ id: string, step: FeedbackStep, feedback: string } | null>(null);

  const handleSort = (key: keyof Campaign) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let list = [...campaigns];
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter(c =>
        c.influencer_name?.toLowerCase().includes(q) ||
        c.influencer_handle.toLowerCase().includes(q) ||
        c.platform?.toLowerCase().includes(q) ||
        c.deliverables?.toLowerCase().includes(q)
      );
    }
    if (filters.status !== 'all') list = list.filter(c => c.status === filters.status);
    if (filters.platform) {
      list = list.filter(c => c.platform?.toLowerCase().trim() === filters.platform.toLowerCase().trim());
    }
    return list.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [campaigns, filters, sortKey, sortDir]);

  const hasFilters = filters.search !== '' || filters.status !== 'all' || filters.platform !== '';

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(filtered.map(c => c.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkStatus = async (status: CampaignStatus) => {
    if (!selectedIds.length) return;
    setIsBulkActioning(true);
    try {
      const res = await bulkUpdateStatus(selectedIds, status);
      toast.success(res.message || `Status update completed.`);
      setSelectedIds([]);
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update status'));
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} campaigns? This cannot be undone.`)) return;
    setIsBulkActioning(true);
    try {
      await bulkDeleteCampaigns(selectedIds);
      toast.success(`Deleted ${selectedIds.length} campaigns`);
      setSelectedIds([]);
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete campaigns'));
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleBulkRemind = async () => {
    if (!selectedIds.length) return;
    setIsBulkActioning(true);
    try {
      await bulkRemindCampaigns(selectedIds);
      toast.success(`Sent reminders for ${selectedIds.length} campaigns`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send reminders'));
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleBulkExport = async () => {
    setIsBulkActioning(true);
    try {
      toast.loading('Preparing CSV export...', { id: 'csv-export' });
      const blob = await exportCsvApi();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collabo_campaigns_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV Exported successfully!', { id: 'csv-export' });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to export CSV'), { id: 'csv-export' });
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleStatusChange = async (id: string, status: CampaignStatus) => {
    setUpdatingId(id);
    if (onOptimisticUpdate) onOptimisticUpdate(id, { status });
    try {
      const campaign = campaigns.find(c => c.id === id);
      await updateCampaignStatus(id, { status });
      
      if (campaign?.status === 'rejected' && (status === 'active' || status === 'content_received')) {
        toast.success('Re-opening campaign for resubmission');
      } else {
        toast.success(`Marked as ${STATUS_CONFIG[status].label}!`);
      }
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update status. Reverting.'));
      onRefresh();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete campaign for ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    if (onOptimisticDelete) onOptimisticDelete(id);
    try {
      await deleteCampaign(id);
      toast.success('Campaign deleted.');
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete campaign. Reverting.'));
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const isOverdue = (c: Campaign) =>
    c.deadline && c.status === 'active' && new Date(c.deadline) < new Date();

  const SortIcon = ({ col }: { col: keyof Campaign }) =>
    sortKey === col
      ? sortDir === 'asc'
        ? <ChevronUp className="w-3 h-3 text-emerald-400" />
        : <ChevronDown className="w-3 h-3 text-emerald-400" />
      : <ChevronUp className="w-3 h-3 text-slate-700" />;

  const uniquePlatforms = [...new Set(campaigns.map(c => c.platform).filter(Boolean))] as string[];

  const handleExportCSV = async () => {
    try {
      toast.loading('Preparing CSV export...', { id: 'csv-export-all' });
      const blob = await exportCsvApi();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collabo_campaigns_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV Exported successfully!', { id: 'csv-export-all' });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to export CSV'), { id: 'csv-export-all' });
    }
  };

  // Normalizes handle to avoid duplicated name / handle text (e.g. Sneha / Sneha)
  const formatHandle = (handle?: string | null, name?: string | null) => {
    if (!handle || handle.trim() === '' || handle.toLowerCase() === 'n/a') {
      return name ? `@${name.toLowerCase().replace(/\s+/g, '')}` : '@creator';
    }
    const clean = handle.trim();
    if (name && clean.toLowerCase() === name.toLowerCase()) {
      return `@${clean.toLowerCase().replace(/\s+/g, '')}`;
    }
    return clean.startsWith('@') ? clean : `@${clean}`;
  };

  return (
    <div className="animate-fade-in w-full">
      {/* ── Unified Tactical Command Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            id="campaign-search"
            type="text"
            placeholder="Search creator, handle, platform, brief..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full bg-white dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 transition-colors font-sans shadow-sm"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: '' }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Actions: Result count + Filters toggle + Export CSV */}
        <div className="flex items-center gap-2">
          {!isLoading && campaigns.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden md:inline mr-1">
              {filtered.length} / {campaigns.length} shown
            </span>
          )}

          <button
            id="filter-toggle-btn"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showFilters || filters.platform
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Platforms</span>
            {filters.platform && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            )}
          </button>
          
          <button
            id="tour-csv-export"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
            title="Export filtered campaigns to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Single-Line Segmented Status Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-white/[0.06] pb-2 mb-3">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'all'
            ? campaigns.length
            : campaigns.filter(c => c.status === f.value).length;
          const isActive = filters.status === f.value;
          const isZero = count === 0 && f.value !== 'all';

          return (
            <button
              key={f.value}
              id={`status-filter-${f.value}`}
              onClick={() => setFilters(prev => ({ ...prev, status: f.value }))}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border select-none ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 font-semibold shadow-sm'
                  : isZero
                  ? 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.02]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`font-mono text-[10px] tabular-nums px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold'
                    : isZero
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Platform Filter Pills (expanded drawer) ── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3 p-2.5 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.07] rounded-lg animate-slide-down">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">Platform:</span>
          <button
            onClick={() => setFilters(f => ({ ...f, platform: '' }))}
            className={`px-2 py-0.5 rounded text-xs transition-colors border ${
              !filters.platform
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Platforms
          </button>
          {uniquePlatforms.map(p => (
            <button
              key={p}
              onClick={() => setFilters(f => ({ ...f, platform: f.platform === p ? '' : p }))}
              className={`px-2 py-0.5 rounded text-xs transition-colors border ${
                filters.platform === p
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => setFilters({ search: '', status: 'all', platform: '' })}
              className="ml-auto text-xs text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* ── Bulk Actions Command Bar ── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 bg-white dark:bg-[#070A10] border border-emerald-500/30 rounded-lg shadow-sm animate-slide-down">
          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 mr-2 flex items-center gap-1.5">
            <span>{selectedIds.length} selected</span>
            {isBulkActioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          </span>
          <button
            onClick={() => handleBulkRemind()}
            disabled={isBulkActioning}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <MessageCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Send Reminder
          </button>
          <button
            onClick={() => handleBulkStatus('active')}
            disabled={isBulkActioning}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <CheckSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Mark Active
          </button>
          <button
            onClick={() => handleBulkStatus('paid')}
            disabled={isBulkActioning}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Mark Paid
          </button>
          <button
            onClick={handleBulkExport}
            disabled={isBulkActioning}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
          >
            <Download className="w-3 h-3 text-slate-500 dark:text-slate-400" /> Export
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isBulkActioning}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && campaigns.length === 0 && (
        <EmptyState onCreateNew={onCreateNew} onLoadSampleData={onLoadSampleData} hasFilters={false} />
      )}
      {!isLoading && campaigns.length > 0 && filtered.length === 0 && (
        <EmptyState 
          onCreateNew={onCreateNew} 
          hasFilters={true} 
          onClearFilters={() => setFilters({ search: '', status: 'all', platform: '' })} 
        />
      )}

      {/* ── 100% Full-Width Table ── */}
      {(isLoading || filtered.length > 0) && (
        <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#070A10]/50 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#0A0E17]/80 text-slate-500 dark:text-slate-400">
                <th className="px-2.5 py-2.5 w-7">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#05070B] text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                {([
                  { key: 'influencer_name', label: 'Influencer' },
                  { key: 'platform',        label: 'Platform' },
                  { key: 'deliverables',    label: 'Deliverables' },
                  { key: 'deadline',        label: 'Deadline' },
                  { key: 'payment_amount',  label: 'Payment' },
                  { key: 'status',          label: 'Status' },
                  { key: 'clicks',          label: 'Tracking' },
                ] as const).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as any)}
                    className="px-2.5 py-2.5 font-sans font-medium text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>{label}</span>
                      <SortIcon col={key as any} />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 font-sans font-medium text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right w-40">
                  Proof / Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map(c => {
                    const overdue = isOverdue(c);
                    const name = c.influencer_name || c.influencer_handle || 'Unknown Creator';
                    const initial = name.slice(0, 2).toUpperCase();
                    const handle = formatHandle(c.influencer_handle, c.influencer_name);

                    return (
                      <tr
                        key={c.id}
                        className={`
                          hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group relative
                          ${deletingId === c.id ? 'opacity-30 pointer-events-none' : ''}
                          ${updatingId === c.id ? 'opacity-60' : ''}
                        `}
                      >
                        {/* Checkbox */}
                        <td className="px-2.5 py-2.5 w-7">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => handleSelectOne(c.id)}
                            className="rounded border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#05070B] text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Influencer */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex items-center gap-2 min-w-[130px]">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] font-mono font-medium text-emerald-600 dark:text-emerald-400">{initial}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-sans font-medium text-slate-900 dark:text-slate-100 truncate">
                                {c.influencer_name || (
                                  <span className="text-slate-400 dark:text-slate-500 italic font-normal">Unspecified</span>
                                )}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{handle}</p>
                            </div>
                          </div>
                        </td>

                        {/* Platform (Case-Insensitive lookup) */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <PlatformBadge platform={c.platform} />
                        </td>

                        {/* Deliverables */}
                        <td className="px-2.5 py-2.5 max-w-[140px]">
                          <span
                            className="text-slate-300 font-sans truncate block"
                            title={c.deliverables || 'No deliverables set'}
                          >
                            {c.deliverables || <span className="text-slate-600 font-mono">—</span>}
                          </span>
                        </td>

                        {/* Deadline (Monospace) */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          {c.deadline ? (
                            <div className="flex items-center gap-1.5 font-mono text-slate-300">
                              {overdue ? (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              )}
                              <span className={overdue ? 'text-rose-400 font-medium' : ''}>
                                {new Date(c.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {overdue && (
                                <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/15 border border-rose-500/25 px-1 py-0.2 rounded">
                                  LATE
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* Payment (Monospace) */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          {(c.payment_amount || 0) > 0 ? (
                            <span className="font-mono tabular-nums font-semibold text-slate-100">
                              ₹{(c.payment_amount || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              Gifted 🎁
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <StatusBadge status={c.status} />
                        </td>

                        {/* Tracking (Compact font-mono pill + Copy Link) */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          {c.short_code ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrackingModalCampaign(c);
                                }}
                                aria-label={`View click analytics for ${c.influencer_name}`}
                                className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Click to view full analytics"
                              >
                                <TrendingUp className="w-3 h-3" />
                                <span>{c.clicks} clicks</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                  navigator.clipboard.writeText(`${origin}/t/${c.short_code}`);
                                  toast.success('Tracking link copied!');
                                }}
                                aria-label="Copy tracking link"
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.04] transition-colors"
                                title={`Copy ${c.destination_url || 'tracking URL'}`}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions (Smooth hover reveal + status dropdown) */}
                        <td className="px-2.5 py-2.5 whitespace-nowrap text-right w-40">
                          <div className="flex items-center justify-end gap-1">
                            {/* Contextual Quick Actions */}
                            {c.status === 'draft' && (
                              <button
                                onClick={() => handleStatusChange(c.id, 'active')}
                                disabled={!!updatingId}
                                title="Activate campaign"
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-30"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {c.status === 'active' && (
                              <button
                                data-tour-target="copy-link-btn"
                                onClick={() => {
                                  if (c.magic_link_token) {
                                    const link = `${window.location.origin}/submit-proof/${c.magic_link_token}`;
                                    navigator.clipboard.writeText(link);
                                    toast.success('Magic link copied to clipboard!');
                                  }
                                }}
                                title="Copy Magic Link for Creator"
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-30"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {c.status === 'content_received' && (
                              <div data-tour-target="approve-reject-actions" className="flex items-center gap-1">
                                {c.proof_history && c.proof_history.length > 0 && (
                                  <div className="relative group/history">
                                    <button
                                      type="button"
                                      title="View Proof Revision History"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProofHistoryCampaign(c);
                                      }}
                                      className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="absolute top-full mt-1.5 right-0 hidden group-hover/history:block w-48 bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-2xl p-2 z-50 animate-fade-in text-left">
                                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1 px-1 border-b border-slate-100 dark:border-white/[0.06] pb-1">Previous Proofs</p>
                                      {c.proof_history.map((h, i) => (
                                        <a
                                          key={i}
                                          href={h.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-between px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white rounded transition-colors font-mono"
                                        >
                                          <span>v{i + 1}</span>
                                          <span className="text-[10px] text-slate-500">{new Date(h.uploaded_at).toLocaleDateString('en-IN')}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {c.proof_url && (
                                  <a
                                    href={c.proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View Proof of Posting"
                                    className="p-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors relative"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => setFeedbackModal({ id: c.id, step: 'input', feedback: '' })}
                                  disabled={!!updatingId}
                                  title="Needs Revision (Request Changes)"
                                  className="p-1 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors disabled:opacity-30"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(c.id, 'approved')}
                                  disabled={!!updatingId}
                                  title="Approve Content"
                                  className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-30"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {c.status === 'approved' && (
                              <button
                                onClick={() => handleStatusChange(c.id, 'paid')}
                                disabled={!!updatingId}
                                title="Mark as Paid"
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-30"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {c.status !== 'content_received' && c.proof_url && (
                              <div className="flex items-center gap-1">
                                {c.proof_history && c.proof_history.length > 0 && (
                                  <button
                                    type="button"
                                    title="View Proof Revision History"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProofHistoryCampaign(c);
                                    }}
                                    className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <a
                                  href={c.proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Proof of Posting"
                                  className="p-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {/* Status Quick-Switch Select */}
                            <select
                              id={`status-select-${c.id}`}
                              value={(c.status as string === 'completed') ? 'paid' : c.status}
                              disabled={updatingId === c.id}
                              onChange={e => handleStatusChange(c.id, e.target.value as CampaignStatus)}
                              className="bg-white dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 text-[11px] rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500/40 disabled:opacity-50 cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.14] transition-colors max-w-[92px]"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="content_received">In Review</option>
                              <option value="needs_revision">Revision</option>
                              <option value="approved">Approved</option>
                              <option value="paid">Paid</option>
                              <option value="rejected">Rejected</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            {/* Edit Action */}
                            {onEdit && (
                              <button
                                onClick={() => onEdit(c)}
                                disabled={!!updatingId}
                                title="Edit campaign details"
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded transition-colors disabled:opacity-30"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Action */}
                            <button
                              onClick={() => handleDelete(c.id, name)}
                              disabled={!!deletingId}
                              title="Delete campaign"
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Proof Revision History Drawer ── */}
      {proofHistoryCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md h-full bg-white dark:bg-[#0A0E17] border-l border-slate-200 dark:border-white/[0.08] p-6 flex flex-col justify-between shadow-2xl animate-slide-in-right overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.06] mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    Proof Revision History
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {proofHistoryCampaign.influencer_name} ({proofHistoryCampaign.influencer_handle})
                  </p>
                </div>
                <button 
                  onClick={() => setProofHistoryCampaign(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Latest Active Proof */}
              {proofHistoryCampaign.proof_url && (
                <div className="mb-5 p-3.5 bg-emerald-500/10 dark:bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                      Latest Submission
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  </div>
                  <a
                    href={proofHistoryCampaign.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-600 dark:text-emerald-300 hover:underline flex items-center gap-1.5 break-all"
                  >
                    <span>{proofHistoryCampaign.proof_url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}

              {/* Previous Iterations */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                  Iteration Log ({proofHistoryCampaign.proof_history?.length || 0})
                </p>
                {proofHistoryCampaign.proof_history && proofHistoryCampaign.proof_history.length > 0 ? (
                  proofHistoryCampaign.proof_history.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200">
                          Version {idx + 1}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {new Date(item.uploaded_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1.5 break-all mt-1.5"
                      >
                        <span className="truncate">{item.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 font-mono py-4 text-center">
                    No prior revisions recorded for this campaign.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-white/[0.06] mt-6">
              <button
                onClick={() => setProofHistoryCampaign(null)}
                className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold transition-colors border border-slate-200 dark:border-white/[0.06]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Affiliate Link Analytics Modal ── */}
      {trackingModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md bg-white dark:bg-[#0A0E17] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  Link Analytics
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{trackingModalCampaign.influencer_name}</p>
              </div>
              <button 
                onClick={() => setTrackingModalCampaign(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5">
              <div className="bg-slate-50 dark:bg-white/[0.02] border border-emerald-500/20 rounded-xl p-5 text-center mb-4">
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Total Verified Clicks</p>
                <p className="font-mono text-5xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  {trackingModalCampaign.clicks}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-200 dark:border-white/[0.06]">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Cost Per Click (CPC)</span>
                  <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                    {trackingModalCampaign.clicks > 0 
                      ? `₹${((trackingModalCampaign.payment_amount || 0) / trackingModalCampaign.clicks).toFixed(2)}` 
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-200 dark:border-white/[0.06]">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Destination</span>
                  <a 
                    href={trackingModalCampaign.destination_url || '#'} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline max-w-[200px] truncate"
                  >
                    {trackingModalCampaign.destination_url || 'None'}
                  </a>
                </div>
              </div>
            </div>
            
            <div className="p-5 pt-0">
              <button
                onClick={() => setTrackingModalCampaign(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold rounded-lg px-4 py-2.5 transition-colors border border-slate-200 dark:border-white/[0.06]"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revision Feedback Modal ── */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md bg-white dark:bg-[#0A0E17] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {feedbackModal.step === 'input' ? 'Request Deliverable Revision' : 'Notify Influencer'}
              </h2>
              <button 
                onClick={() => setFeedbackModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5">
              {feedbackModal.step === 'input' ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Specify required edits. This will mark the campaign as "Needs Revision" and generate a WhatsApp template.
                  </p>
                  <textarea
                    autoFocus
                    value={feedbackModal.feedback}
                    onChange={e => setFeedbackModal({ ...feedbackModal, feedback: e.target.value })}
                    placeholder="E.g., The product packaging is partially obscured during seconds 0:04–0:08..."
                    className="w-full h-28 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] rounded-lg p-3 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
                  />
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setFeedbackModal(null)}
                      className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors border border-slate-200 dark:border-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updateCampaignStatus(feedbackModal.id, { status: 'needs_revision', feedback: feedbackModal.feedback });
                          toast.success('Status updated to Needs Revision');
                          onRefresh();
                          setFeedbackModal({ ...feedbackModal, step: 'share' });
                        } catch (err) {
                          toast.error(getApiErrorMessage(err, 'Failed to update status'));
                        }
                      }}
                      disabled={!feedbackModal.feedback.trim()}
                      className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] disabled:opacity-50"
                    >
                      Save & Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Copy or dispatch this revision notice directly via WhatsApp.
                  </p>
                  {(() => {
                    const campaign = campaigns.find(c => c.id === feedbackModal.id);
                    const link = campaign?.magic_link_token ? `${window.location.origin}/submit-proof/${campaign.magic_link_token}` : '';
                    const message = `Hi ${campaign?.influencer_name || 'there'},\n\nYour recent Collabo proof needs a quick revision.\n\nFeedback: ${feedbackModal.feedback}\n\nPlease upload the updated version here:\n${link}`;
                    
                    return (
                      <>
                        <textarea
                          readOnly
                          value={message}
                          className="w-full h-40 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] rounded-lg p-3 text-slate-800 dark:text-slate-200 text-xs font-mono focus:outline-none resize-none"
                        />
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(message);
                              toast.success('Notice copied to clipboard!');
                            }}
                            className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-200 dark:border-white/[0.06]"
                          >
                            Copy Message
                          </button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setFeedbackModal(null)}
                            className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] text-center flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Send WhatsApp
                          </a>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

