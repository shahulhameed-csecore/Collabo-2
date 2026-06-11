'use client';

import { useState } from 'react';
import type { Campaign, CampaignStatus } from '@/lib/types';
import { updateCampaignStatus, deleteCampaign } from '@/lib/api';
import {
  ChevronUp, ChevronDown, MoreVertical, Trash2,
  Calendar, DollarSign, Tag, AlertCircle, CheckCircle2,
  Clock, XCircle, Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface CampaignTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; dotClass: string; badgeClass: string }> = {
  active:    { label: 'Active',    dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  draft:     { label: 'Draft',     dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  completed: { label: 'Completed', dotClass: 'bg-slate-400',   badgeClass: 'bg-slate-700/50 text-slate-400 border-slate-600/30' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-rose-400',    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

const PLATFORMS = ['Instagram', 'YouTube', 'Twitter/X', 'LinkedIn', 'TikTok', 'Other'];

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/40">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-800 rounded-lg animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function CampaignTable({ campaigns, isLoading, onRefresh, onCreateNew }: CampaignTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof Campaign>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSort = (key: keyof Campaign) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleStatusChange = async (id: string, status: CampaignStatus) => {
    setUpdatingId(id);
    try {
      await updateCampaignStatus(id, { status });
      toast.success('Campaign status updated!');
      onRefresh();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
    setDeletingId(id);
    setOpenMenuId(null);
    try {
      await deleteCampaign(id);
      toast.success('Campaign deleted.');
      onRefresh();
    } catch {
      toast.error('Failed to delete campaign.');
    } finally {
      setDeletingId(null);
    }
  };

  const SortIcon = ({ col }: { col: keyof Campaign }) => (
    sortKey === col
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)
      : <ChevronUp className="w-3 h-3 text-slate-600" />
  );

  const isOverdue = (c: Campaign) => c.deadline && c.status === 'active' && new Date(c.deadline) < new Date();

  if (!isLoading && campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="p-5 bg-slate-800/40 rounded-2xl mb-5">
          <Tag className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No campaigns yet</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          Start tracking your first influencer campaign. Upload a screenshot and let AI do the heavy lifting.
        </p>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25"
        >
          <Plus className="w-4 h-4" /> Create First Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800/60 bg-slate-900/50">
            {(['influencer_name', 'platform', 'deadline', 'payment_amount', 'status'] as const).map((col) => (
              <th key={col} onClick={() => handleSort(col)} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors">
                <div className="flex items-center gap-1.5">
                  {col.replace('_', ' ')} <SortIcon col={col} />
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : sorted.map((c) => {
                const overdue = isOverdue(c);
                return (
                  <tr key={c.id} className={`hover:bg-slate-800/30 transition-colors group ${deletingId === c.id ? 'opacity-40' : ''}`}>
                    {/* Influencer Name */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-400">{(c.influencer_name ?? c.influencer_handle).slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{c.influencer_name ?? '—'}</p>
                          <p className="text-xs text-slate-500">{c.influencer_handle}</p>
                        </div>
                      </div>
                    </td>

                    {/* Platform */}
                    <td className="px-4 py-4">
                      <span className="text-slate-300">{c.platform ?? '—'}</span>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-4">
                      {c.deadline ? (
                        <div className={`flex items-center gap-1.5 ${overdue ? 'text-rose-400' : 'text-slate-300'}`}>
                          {overdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5 text-slate-500" />}
                          <span className="text-sm">{new Date(c.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {overdue && <span className="text-xs text-rose-400 font-medium">Overdue</span>}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-slate-300">
                        <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                        {c.payment_amount > 0 ? (
                          <span>₹{c.payment_amount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-500 italic">Barter</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={c.status}
                          disabled={updatingId === c.id}
                          onChange={(e) => handleStatusChange(c.id, e.target.value as CampaignStatus)}
                          className="bg-slate-800 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={!!deletingId}
                          className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Delete campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
          }
        </tbody>
      </table>
    </div>
  );
}
