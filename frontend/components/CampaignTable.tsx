'use client';

import { useState, useMemo } from 'react';
import type { Campaign, CampaignStatus, FilterState } from '@/lib/types';
import { updateCampaignStatus, deleteCampaign, getApiErrorMessage } from '@/lib/api';
import {
  ChevronUp, ChevronDown, Trash2,
  Calendar, DollarSign, AlertCircle, CheckCircle2,
  Clock, XCircle, Plus, Search, Filter,
  Globe, X, Check, Tag,
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<CampaignStatus, {
  label: string; dotClass: string; badgeClass: string; icon: React.ElementType;
}> = {
  active:    { label: 'Active',    dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: CheckCircle2 },
  draft:     { label: 'Draft',     dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25',   icon: Clock },
  completed: { label: 'Completed', dotClass: 'bg-slate-400',   badgeClass: 'bg-slate-700/60 text-slate-400 border-slate-600/30',   icon: Check },
  cancelled: { label: 'Cancelled', dotClass: 'bg-rose-400',    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/25',     icon: XCircle },
};

// ─── Platform color map ────────────────────────────────────────────────────────
const PLATFORM_COLOR: Record<string, string> = {
  'Instagram':   'text-pink-400',
  'YouTube':     'text-red-400',
  'Twitter/X':   'text-sky-400',
  'LinkedIn':    'text-blue-400',
  'TikTok':      'text-purple-400',
  'Pinterest':   'text-rose-400',
};

const STATUS_FILTERS: { value: FilterState['status']; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'draft',     label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-slate-600 text-sm">—</span>;
  const color = PLATFORM_COLOR[platform] ?? 'text-slate-300';
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <Globe className="w-3 h-3 opacity-70" />
      {platform}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/40">
      {[80, 60, 70, 50, 60, 40].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="skeleton h-4 rounded-lg" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ onCreateNew, hasFilters }: { onCreateNew: () => void; hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="p-4 bg-slate-800/40 rounded-2xl mb-4">
          <Search className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">No campaigns match</h3>
        <p className="text-slate-500 text-sm">Try adjusting your search or filter.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-xl" />
        <div className="relative p-6 bg-slate-800/60 rounded-2xl border border-slate-700/40">
          <DollarSign className="w-10 h-10 text-emerald-400" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No campaigns yet</h3>
      <p className="text-slate-500 text-sm max-w-xs mb-6 leading-relaxed">
        Start tracking your influencer deals. Upload a DM screenshot and let AI fill in the details.
      </p>
      <button
        onClick={onCreateNew}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25"
      >
        <Plus className="w-4 h-4" />
        Create First Campaign
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignTable({ campaigns, isLoading, onRefresh, onCreateNew }: CampaignTableProps) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: 'all', platform: '' });
  const [sortKey, setSortKey] = useState<keyof Campaign>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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

  return (
    <div className="animate-fade-in">
      {/* ── Search + Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, handle, platform..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full bg-slate-900/60 border border-slate-800/60 text-white placeholder-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          id="filter-toggle-btn"
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            showFilters || hasFilters
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-900/60 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
          )}
        </button>
      </div>

      {/* ── Filter Pills ── */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-900/40 border border-slate-800/40 rounded-xl animate-slide-down">
          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-500 mr-1">Status:</span>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilters(prev => ({ ...prev, status: f.value }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  filters.status === f.value
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Platform filter */}
          {uniquePlatforms.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-slate-500 mr-1">Platform:</span>
              <button
                onClick={() => setFilters(f => ({ ...f, platform: '' }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  !filters.platform
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              {uniquePlatforms.map(p => (
                <button
                  key={p}
                  onClick={() => setFilters(f => ({ ...f, platform: f.platform === p ? '' : p }))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filters.platform === p
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {/* Clear */}
          {hasFilters && (
            <button
              onClick={() => setFilters({ search: '', status: 'all', platform: '' })}
              className="ml-auto text-xs text-slate-500 hover:text-rose-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      {!isLoading && campaigns.length > 0 && (
        <p className="text-xs text-slate-500 mb-3">
          Showing <span className="text-white font-medium">{filtered.length}</span> of {campaigns.length} campaigns
        </p>
      )}

      {/* ── Empty State ── */}
      {!isLoading && campaigns.length === 0 && (
        <EmptyState onCreateNew={onCreateNew} hasFilters={false} />
      )}
      {!isLoading && campaigns.length > 0 && filtered.length === 0 && (
        <EmptyState onCreateNew={onCreateNew} hasFilters={true} />
      )}

      {/* ── Table ── */}
      {(isLoading || filtered.length > 0) && (
        <div className="overflow-x-auto rounded-xl border border-slate-800/50">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-800/60 bg-slate-900/50">
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
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.map(c => {
                    const overdue = isOverdue(c);
                    const name = c.influencer_name ?? c.influencer_handle;
                    return (
                      <tr
                        key={c.id}
                        className={`
                          hover:bg-slate-800/20 transition-colors group
                          ${deletingId === c.id ? 'opacity-30 pointer-events-none' : ''}
                          ${updatingId === c.id ? 'opacity-60' : ''}
                        `}
                      >
                        {/* Influencer */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400/15 to-teal-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-emerald-400">
                                {name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate max-w-[140px]">
                                {c.influencer_name ?? <span className="text-slate-500 italic font-normal text-xs">No name</span>}
                              </p>
                              <p className="text-xs text-slate-500 truncate max-w-[140px]">{c.influencer_handle}</p>
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
                            <div className={`flex items-center gap-1.5 ${overdue ? 'text-rose-400' : 'text-slate-300'}`}>
                              {overdue
                                ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                : <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                              <span className="text-sm whitespace-nowrap">
                                {new Date(c.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {overdue && <span className="text-xs font-semibold text-rose-400 whitespace-nowrap">Overdue!</span>}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="px-4 py-3.5">
                          {c.payment_amount > 0 ? (
                            <span className="font-semibold text-white">
                              ₹{c.payment_amount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              Barter
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={c.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {/* Quick: Mark Complete */}
                            {c.status === 'active' && (
                              <button
                                onClick={() => handleStatusChange(c.id, 'completed')}
                                disabled={!!updatingId}
                                title="Mark as Completed"
                                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            {/* Status select */}
                            <select
                              value={c.status}
                              disabled={updatingId === c.id}
                              onChange={e => handleStatusChange(c.id, e.target.value as CampaignStatus)}
                              className="bg-slate-800/80 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/40 disabled:opacity-50 cursor-pointer hover:border-slate-600 transition-colors"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(c.id, name)}
                              disabled={!!deletingId}
                              title="Delete campaign"
                              className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
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
