'use client';

import { useState, useMemo } from 'react';
import type { Campaign, CampaignStatus, FilterState } from '@/lib/types';
import { updateCampaignStatus, deleteCampaign, getApiErrorMessage } from '@/lib/api';
import {
  ChevronUp, ChevronDown, Trash2,
  Calendar, DollarSign, AlertCircle, CheckCircle2,
  Clock, XCircle, Plus, Search, Filter,
  Globe, X, Check, ExternalLink, Edit2, FileSpreadsheet, Database
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  onEdit?: (campaign: Campaign) => void;
  onLoadSampleData?: () => void;
  onClearSampleData?: () => void;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<CampaignStatus, {
  label: string; dotClass: string; badgeClass: string; icon: React.ElementType;
}> = {
  active:           { label: 'Active',           dotClass: 'bg-emerald-500 dark:bg-emerald-400', badgeClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25', icon: CheckCircle2 },
  draft:            { label: 'Draft',            dotClass: 'bg-amber-500 dark:bg-amber-400',   badgeClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',   icon: Clock },
  content_received: { label: 'In Review',        dotClass: 'bg-purple-500 dark:bg-purple-400',  badgeClass: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/25', icon: CheckCircle2 },
  approved:         { label: 'Approved',         dotClass: 'bg-blue-500 dark:bg-blue-400',    badgeClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/25',      icon: Check },
  paid:             { label: 'Paid',             dotClass: 'bg-slate-500 dark:bg-slate-400',   badgeClass: 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600/30',   icon: DollarSign },
  cancelled:        { label: 'Cancelled',        dotClass: 'bg-rose-500 dark:bg-rose-400',    badgeClass: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/25',      icon: XCircle },
};

// ─── Platform config ──────────────────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { color: string; bg: string; emoji: string }> = {
  'Instagram':  { color: 'text-pink-600 dark:text-pink-400',   bg: 'bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20',    emoji: '📸' },
  'YouTube':    { color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',      emoji: '▶️' },
  'Twitter/X':  { color: 'text-sky-600 dark:text-sky-400',    bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',      emoji: '𝕏' },
  'LinkedIn':   { color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',    emoji: 'in' },
  'TikTok':     { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20', emoji: '♪' },
  'Pinterest':  { color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',    emoji: '📌' },
  'Snapchat':   { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20', emoji: '👻' },
};

const STATUS_FILTERS: { value: FilterState['status']; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'active',           label: 'Active' },
  { value: 'draft',            label: 'Draft' },
  { value: 'content_received', label: 'In Review' },
  { value: 'approved',         label: 'Approved' },
  { value: 'paid',             label: 'Paid' },
  { value: 'cancelled',        label: 'Cancelled' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CampaignStatus }) {
  // Defensive fallback for legacy or invalid statuses
  const normalizedStatus = (status as string === 'completed') ? 'paid' : status;
  const cfg = STATUS_CONFIG[normalizedStatus as CampaignStatus] || {
    label: String(status || 'Unknown'),
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600/30',
    icon: Clock,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-slate-600 text-sm">—</span>;
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border ${cfg ? cfg.bg : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/30'} ${cfg ? cfg.color : 'text-slate-600 dark:text-slate-300'}`}>
      {cfg
        ? <span className="text-[10px] leading-none">{cfg.emoji}</span>
        : <Globe className="w-3 h-3 opacity-70" />}
      {platform}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/40">
      {[75, 55, 65, 50, 55, 40].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="skeleton h-4 rounded-lg" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ onCreateNew, onLoadSampleData, hasFilters }: { onCreateNew: () => void; onLoadSampleData?: () => void; hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl mb-4 border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none">
          <Search className="w-8 h-8 text-slate-400 dark:text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No campaigns match</h3>
        <p className="text-slate-500 text-sm">Try adjusting your search or filter.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-xl" />
        <div className="relative p-6 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/40 shadow-sm dark:shadow-none">
          <DollarSign className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No campaigns yet</h3>
      <p className="text-slate-500 text-sm max-w-sm mb-8 leading-relaxed">
        Start tracking your influencer deals. Upload a DM screenshot and let our AI instantly fill in all the details for you.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25"
        >
          <Plus className="w-4 h-4" />
          Create First Campaign
        </button>
        {onLoadSampleData && (
          <button
            onClick={onLoadSampleData}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all border border-slate-200 dark:border-slate-700"
          >
            <Database className="w-4 h-4" />
            Load Sample Data
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignTable({ campaigns, isLoading, onRefresh, onCreateNew, onEdit, onLoadSampleData, onClearSampleData }: CampaignTableProps) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: 'all', platform: '' });
  const [sortKey, setSortKey] = useState<keyof Campaign>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const handleStatusChange = async (id: string, status: CampaignStatus) => {
    setUpdatingId(id);
    setOpenMenuId(null);
    try {
      await updateCampaignStatus(id, { status });
      toast.success(`Marked as ${STATUS_CONFIG[status].label}!`);
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update status.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete campaign for ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    setOpenMenuId(null);
    try {
      await deleteCampaign(id);
      toast.success('Campaign deleted.');
      onRefresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete campaign.'));
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
      c.deadline || '',
      c.payment_amount || 0,
      c.status,
      c.created_at
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

      {/* ── Result count ── */}
      {!isLoading && campaigns.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">
            Showing <span className="text-slate-900 dark:text-white font-medium">{filtered.length}</span> of {campaigns.length} campaigns
            {hasFilters && <span className="text-emerald-500/70"> (filtered)</span>}
          </p>
          {onClearSampleData && campaigns.some(c => c.influencer_name?.includes('Sample')) && (
            <button 
              onClick={onClearSampleData}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-medium underline"
            >
              Clear Sample Data
            </button>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && campaigns.length === 0 && (
        <EmptyState onCreateNew={onCreateNew} onLoadSampleData={onLoadSampleData} hasFilters={false} />
      )}
      {!isLoading && campaigns.length > 0 && filtered.length === 0 && (
        <EmptyState onCreateNew={onCreateNew} hasFilters={true} />
      )}

      {/* ── Table ── */}
      {(isLoading || filtered.length > 0) && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/50 shadow-sm dark:shadow-none bg-white dark:bg-transparent">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/60">
                {([
                  { key: 'influencer_name', label: 'Influencer' },
                  { key: 'platform',        label: 'Platform' },
                  { key: 'deadline',        label: 'Deadline' },
                  { key: 'payment_amount',  label: 'Payment' },
                  { key: 'status',          label: 'Status' },
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
                              <>
                                {c.proof_url && (
                                  <a
                                    href={c.proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View Proof of Posting"
                                    className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleStatusChange(c.id, 'approved')}
                                  disabled={!!updatingId}
                                  title="Approve Content"
                                  className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-30"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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
                              <option value="content_received" disabled>In Review</option>
                              <option value="approved">Approved</option>
                              <option value="paid">Paid</option>
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
    </div>
  );
}
