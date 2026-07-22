'use client';

import { useState, useMemo } from 'react';
import type { Campaign, CampaignStatus, FilterState } from '@/lib/types';
import { updateCampaignStatus, deleteCampaign, getApiErrorMessage, bulkUpdateStatus, bulkDeleteCampaigns, bulkRemindCampaigns } from '@/lib/api';
import {
  ChevronUp, ChevronDown, Trash2,
  Calendar, DollarSign, AlertCircle, CheckCircle2,
  Clock, XCircle, Search, Filter,
  Globe, X, Check, ExternalLink, Edit2, FileSpreadsheet, Database,
  MessageCircle, Download, CheckSquare, Link as LinkIcon, TrendingUp, Loader2
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
  PLATFORM_CONFIG,
  STATUS_FILTERS,
  StatusBadge,
  PlatformBadge,
  SkeletonRow,
  EmptyState
} from '@/components/CampaignTableUtils';

// ─── Main Component ───────────────────────────────────────────────────────────
const formatCSVDate = (dateStr?: string | null) => {
  if (!dateStr) return '""';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '""';
    return `"${d.toISOString().split('T')[0]}"`;
  } catch {
    return '""';
  }
};

export default function CampaignTable({ campaigns, isLoading, onRefresh, onCreateNew, onEdit, onLoadSampleData, onOptimisticUpdate, onOptimisticDelete }: CampaignTableProps) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: 'all', platform: '' });
  const [sortKey, setSortKey] = useState<keyof Campaign>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [trackingModalCampaign, setTrackingModalCampaign] = useState<Campaign | null>(null);

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
    if (filters.platform) list = list.filter(c => c.platform === filters.platform);
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
      await bulkUpdateStatus(selectedIds, status);
      toast.success(`Marked ${selectedIds.length} campaigns as ${STATUS_CONFIG[status].label}`);
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

  const handleBulkExport = () => {
    if (!selectedIds.length) return;
    const toExport = filtered.filter(c => selectedIds.includes(c.id));
    const headers = ['Influencer Name', 'Handle', 'Platform', 'Deliverables', 'Deadline', 'Payment Amount', 'Status', 'Created At'];
    const rows = toExport.map(c => [
      `"${c.influencer_name || ''}"`,
      `"${c.influencer_handle || ''}"`,
      `"${c.platform || ''}"`,
      `"${(c.deliverables || '').replace(/"/g, '""')}"`,
      formatCSVDate(c.deadline),
      c.payment_amount || 0,
      `"${c.status}"`,
      formatCSVDate(c.created_at)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabo_selected_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Selected campaigns exported successfully!');
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
      // No need to onRefresh if it's optimistic, unless we want the real timestamp.
      // But we will refresh in the background silently.
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update status. Reverting.'));
      onRefresh(); // Revert
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

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error('No campaigns to export.');
      return;
    }
    
    const headers = ['Influencer Name', 'Handle', 'Platform', 'Deliverables', 'Deadline', 'Payment Amount', 'Status', 'Created At'];
    const rows = filtered.map(c => [
      `"${c.influencer_name || ''}"`,
      `"${c.influencer_handle || ''}"`,
      `"${c.platform || ''}"`,
      `"${(c.deliverables || '').replace(/"/g, '""')}"`,
      formatCSVDate(c.deadline),
      c.payment_amount || 0,
      `"${c.status}"`,
      formatCSVDate(c.created_at)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabo_campaigns_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV Exported successfully!');
  };

  return (
    <div className="animate-fade-in">
      {/* ── Search + Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="campaign-search"
            type="text"
            placeholder="Search by name, handle, platform..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-sm dark:shadow-none"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <button
            id="filter-toggle-btn"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all shadow-sm dark:shadow-none ${
              showFilters || hasFilters
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            )}
          </button>
          
          <button
            id="tour-csv-export"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm dark:shadow-none"
            title="Export filtered campaigns to CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Status Quick Filters (always visible) ── */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'all'
            ? campaigns.length
            : campaigns.filter(c => c.status === f.value).length;
          return (
            <button
              key={f.value}
              id={`status-filter-${f.value}`}
              onClick={() => setFilters(prev => ({ ...prev, status: f.value }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filters.status === f.value
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                  : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm dark:shadow-none'
              }`}
            >
              {f.label}
              <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                filters.status === f.value ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-slate-500 dark:text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Platform Filter Pills (expanded) ── */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/40 rounded-xl animate-slide-down shadow-sm dark:shadow-none">
          {uniquePlatforms.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap w-full">
              <span className="text-xs text-slate-500 font-medium mr-1">Platform:</span>
              <button
                onClick={() => setFilters(f => ({ ...f, platform: '' }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  !filters.platform
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50'
                }`}
              >
                All Platforms
              </button>
              {uniquePlatforms.map(p => (
                <button
                  key={p}
                  onClick={() => setFilters(f => ({ ...f, platform: f.platform === p ? '' : p }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.platform === p
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">No platforms to filter by yet.</p>
          )}
          {hasFilters && (
            <button
              onClick={() => setFilters({ search: '', status: 'all', platform: '' })}
              className="ml-auto text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-sm animate-slide-down">
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mr-2 flex items-center gap-2">
            {selectedIds.length} selected
            {isBulkActioning && <Loader2 className="w-4 h-4 animate-spin" />}
          </span>
          <button
            onClick={() => handleBulkRemind()}
            disabled={isBulkActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Send Reminder
          </button>
          <button
            onClick={() => handleBulkStatus('active')}
            disabled={isBulkActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Mark Active
          </button>
          <button
            onClick={() => handleBulkStatus('paid')}
            disabled={isBulkActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Mark Completed
          </button>
          <button
            onClick={handleBulkExport}
            disabled={isBulkActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isBulkActioning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors disabled:opacity-50 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}

      {/* ── Result count ── */}
      {!isLoading && campaigns.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">
            Showing <span className="text-slate-900 dark:text-white font-medium">{filtered.length}</span> of {campaigns.length} campaigns
            {hasFilters && <span className="text-emerald-500/70"> (filtered)</span>}
          </p>
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

      {/* ── Table ── */}
      {(isLoading || filtered.length > 0) && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/50 shadow-sm dark:shadow-none bg-white dark:bg-transparent">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/60">
                <th className="px-4 py-3 w-10 text-left">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                  />
                </th>
                {([
                  { key: 'influencer_name', label: 'Influencer' },
                  { key: 'platform',        label: 'Platform' },
                  { key: 'deadline',        label: 'Deadline' },
                  { key: 'payment_amount',  label: 'Payment' },
                  { key: 'status',          label: 'Status' },
                  { key: 'clicks',          label: 'Tracking' },
                ] as const).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-36">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map(c => {
                    const overdue = isOverdue(c);
                    const name = c.influencer_name || c.influencer_handle || 'Unknown';
                    const initial = name.slice(0, 2).toUpperCase();
                    return (
                      <tr
                        key={c.id}
                        className={`
                          hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group relative
                          ${deletingId === c.id ? 'opacity-30 pointer-events-none' : ''}
                          ${updatingId === c.id ? 'opacity-60' : ''}
                        `}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => handleSelectOne(c.id)}
                            className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                          />
                        </td>

                        {/* Influencer */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400/15 to-teal-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-emerald-400">{initial}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                                {c.influencer_name || (
                                  <span className="text-slate-400 dark:text-slate-500 italic font-normal text-xs">No name</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 truncate max-w-[140px] font-mono">{c.influencer_handle || 'No handle'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Platform */}
                        <td className="px-4 py-3.5">
                          <PlatformBadge platform={c.platform} />
                        </td>

                        {/* Deadline */}
                        <td className="px-4 py-3.5">
                          {c.deadline ? (
                            <div className={`flex items-center gap-1.5 ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {overdue
                                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                                : <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />}
                              <span className="text-sm whitespace-nowrap">
                                {new Date(c.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {overdue && (
                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                  Overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="px-4 py-3.5">
                          {(c.payment_amount || 0) > 0 ? (
                            <span className="font-bold text-slate-900 dark:text-white">
                              ₹{(c.payment_amount || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md">
                              Gifted 🎁
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={c.status} />
                        </td>

                        {/* Tracking */}
                        <td className="px-4 py-3.5">
                          {c.short_code ? (
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrackingModalCampaign(c);
                                }}
                                aria-label={`View click analytics for ${c.influencer_name}`}
                                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-500/5"
                                title="View detailed click analytics"
                              >
                                <TrendingUp className="w-3 h-3" />
                                {c.clicks} clicks
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'https://collabo-2.onrender.com';
                                  navigator.clipboard.writeText(`${baseUrl}/t/${c.short_code}`);
                                  toast.success('Tracking link copied!');
                                }}
                                aria-label="Copy tracking link"
                                className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1 mt-0.5"
                                title={c.destination_url || ''}
                              >
                                <LinkIcon className="w-3 h-3" /> Copy Link
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {/* Action Buttons based on status */}
                            {c.status === 'draft' && (
                              <button
                                onClick={() => handleStatusChange(c.id, 'active')}
                                disabled={!!updatingId}
                                title="Activate campaign"
                                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
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
                                title="Copy Magic Link for Influencer"
                                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {c.status === 'content_received' && (
                              <div data-tour-target="approve-reject-actions" className="flex items-center gap-1">
                                {c.proof_history && c.proof_history.length > 0 && (
                                  <div className="relative group/history">
                                    <button
                                      title="View Proof History"
                                      className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/history:block w-48 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl p-2 z-50 animate-fade-in">
                                      <p className="text-xs font-bold text-slate-300 mb-1.5 px-1 border-b border-slate-700/50 pb-1">Previous Submissions</p>
                                      {c.proof_history.map((h, i) => (
                                        <a
                                          key={i}
                                          href={h.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-between px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                                        >
                                          <span>Version {i + 1}</span>
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
                                    title="View Latest Proof of Posting"
                                    className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 relative"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                    {c.proof_history && c.proof_history.length > 0 && (
                                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-white dark:border-slate-900"></span>
                                    )}
                                  </a>
                                )}
                                <button
                                  onClick={() => handleStatusChange(c.id, 'rejected')}
                                  disabled={!!updatingId}
                                  title="Not Approved (Reject Content)"
                                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(c.id, 'approved')}
                                  disabled={!!updatingId}
                                  title="Approve Content"
                                  className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
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
                                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Status select */}
                            <select
                              id={`status-select-${c.id}`}
                              value={(c.status as string === 'completed') ? 'paid' : c.status}
                              disabled={updatingId === c.id}
                              onChange={e => handleStatusChange(c.id, e.target.value as CampaignStatus)}
                              className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/40 disabled:opacity-50 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors max-w-[96px] shadow-sm dark:shadow-none"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="content_received">In Review</option>
                              <option value="needs_revision">Needs Revision</option>
                              <option value="approved">Approved</option>
                              <option value="paid">Paid</option>
                              <option value="rejected">Not Approved</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            {/* Edit */}
                            {onEdit && (
                              <button
                                onClick={() => onEdit(c)}
                                disabled={!!updatingId}
                                title="Edit campaign"
                                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(c.id, name)}
                              disabled={!!deletingId}
                              title="Delete campaign"
                              className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
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

      {/* Link Analytics Modal */}
      {trackingModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Link Analytics
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{trackingModalCampaign.influencer_name}</p>
              </div>
              <button 
                onClick={() => setTrackingModalCampaign(null)}
                className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl p-6 text-center mb-6">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-2">Total Clicks</p>
                <p className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
                  {trackingModalCampaign.clicks}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost Per Click (CPC)</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {trackingModalCampaign.clicks > 0 
                      ? `₹${((trackingModalCampaign.payment_amount || 0) / trackingModalCampaign.clicks).toFixed(2)}` 
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/30">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Destination</span>
                  <a 
                    href={trackingModalCampaign.destination_url || '#'} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-blue-500 hover:underline max-w-[200px] truncate"
                  >
                    {trackingModalCampaign.destination_url || 'None'}
                  </a>
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-0">
              <button
                onClick={() => setTrackingModalCampaign(null)}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl px-5 py-3 transition-colors"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
