import {
  Clock, CheckCircle2, Check, DollarSign, XCircle, Globe, Search, X, Plus, Database, MessageCircle
} from 'lucide-react';
import type { CampaignStatus, FilterState } from '@/lib/types';

export const STATUS_CONFIG: Record<CampaignStatus, {
  label: string; dotClass: string; badgeClass: string; icon: React.ElementType;
}> = {
  active:           { label: 'Active',           dotClass: 'bg-emerald-500 dark:bg-emerald-400', badgeClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25', icon: CheckCircle2 },
  draft:            { label: 'Draft',            dotClass: 'bg-amber-500 dark:bg-amber-400',   badgeClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',   icon: Clock },
  content_received: { label: 'In Review',        dotClass: 'bg-purple-500 dark:bg-purple-400',  badgeClass: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/25', icon: CheckCircle2 },
  approved:         { label: 'Approved',         dotClass: 'bg-blue-500 dark:bg-blue-400',    badgeClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/25',      icon: Check },
  paid:             { label: 'Paid',             dotClass: 'bg-slate-500 dark:bg-slate-400',   badgeClass: 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600/30',   icon: DollarSign },
  cancelled:        { label: 'Cancelled',        dotClass: 'bg-rose-500 dark:bg-rose-400',    badgeClass: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/25',      icon: XCircle },
  rejected:         { label: 'Not Approved',     dotClass: 'bg-red-500 dark:bg-red-400',      badgeClass: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25',        icon: XCircle },
};

export const PLATFORM_CONFIG: Record<string, { color: string; bg: string; emoji: string }> = {
  'Instagram':  { color: 'text-pink-600 dark:text-pink-400',   bg: 'bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20',    emoji: '📸' },
  'YouTube':    { color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',      emoji: '▶️' },
  'Twitter/X':  { color: 'text-sky-600 dark:text-sky-400',    bg: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',      emoji: '𝕏' },
  'LinkedIn':   { color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',    emoji: 'in' },
  'TikTok':     { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20', emoji: '♪' },
  'Pinterest':  { color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',    emoji: '📌' },
  'Snapchat':   { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20', emoji: '👻' },
};

export const STATUS_FILTERS: { value: FilterState['status']; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'active',           label: 'Active' },
  { value: 'draft',            label: 'Draft' },
  { value: 'content_received', label: 'In Review' },
  { value: 'approved',         label: 'Approved' },
  { value: 'paid',             label: 'Paid' },
  { value: 'rejected',         label: 'Not Approved' },
  { value: 'cancelled',        label: 'Cancelled' },
];

export function StatusBadge({ status }: { status: CampaignStatus }) {
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

export function PlatformBadge({ platform }: { platform: string | null }) {
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

export function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/40 animate-pulse">
      <td className="px-4 py-4 w-10"><div className="skeleton w-4 h-4 rounded" /></td>
      {[75, 55, 65, 50, 55, 40].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="skeleton h-4 rounded-lg" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function EmptyState({ onCreateNew, onLoadSampleData, hasFilters, onClearFilters }: { onCreateNew: () => void; onLoadSampleData?: () => void; hasFilters: boolean; onClearFilters?: () => void; }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative mb-4 group cursor-default">
          <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full blur-lg opacity-50 group-hover:scale-110 transition-transform duration-500" />
          <div className="relative p-4 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <Search className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No campaigns match</h3>
        <p className="text-slate-500 text-sm mb-6">Try adjusting your search or filters to find what you're looking for.</p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-full px-5 py-2.5 text-sm transition-all border border-slate-200 dark:border-slate-700"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mb-6 group">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 group-hover:scale-110 transition-all duration-700" />
        <div className="relative p-6 bg-white dark:bg-slate-900 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-xl shadow-emerald-500/10 transform group-hover:-translate-y-1 transition-all duration-300">
          <MessageCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Forward a message to get started!</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
        Connect your WhatsApp or Telegram and simply forward any brand negotiation, voice note, or creator invoice to Collabo AI. We'll automatically track it here!
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-full px-6 py-3 text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create First Campaign
        </button>
        {onLoadSampleData && (
          <button
            id="load-sample-data-btn"
            onClick={onLoadSampleData}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-full px-6 py-3 text-sm transition-all border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            <Database className="w-4 h-4" />
            Load Sample Data
          </button>
        )}
      </div>
    </div>
  );
}
