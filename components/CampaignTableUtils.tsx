import {
  Clock, CheckCircle2, Check, DollarSign, XCircle, Globe, Search, X, Plus, Database, MessageCircle, AlertCircle
} from 'lucide-react';
import type { CampaignStatus, FilterState } from '@/lib/types';

export const STATUS_CONFIG: Record<CampaignStatus, {
  label: string; dotClass: string; badgeClass: string; icon: React.ElementType;
}> = {
  active:           { label: 'Active',           dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  draft:            { label: 'Draft',            dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   icon: Clock },
  content_received: { label: 'In Review',        dotClass: 'bg-purple-400',  badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: CheckCircle2 },
  needs_revision:   { label: 'Needs Revision',   dotClass: 'bg-orange-400', badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: AlertCircle },
  approved:         { label: 'Approved',         dotClass: 'bg-blue-400',    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',      icon: Check },
  paid:             { label: 'Paid',             dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', icon: DollarSign },
  cancelled:        { label: 'Cancelled',        dotClass: 'bg-rose-400',    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',      icon: XCircle },
  rejected:         { label: 'Not Approved',     dotClass: 'bg-red-400',      badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20',        icon: XCircle },
};

export const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  'instagram':  { label: 'Instagram',  color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20',    emoji: '📸' },
  'youtube':    { label: 'YouTube',    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',      emoji: '▶️' },
  'twitter':    { label: 'Twitter/X',  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20',      emoji: '𝕏' },
  'x':          { label: 'Twitter/X',  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20',      emoji: '𝕏' },
  'twitter/x':  { label: 'Twitter/X',  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20',      emoji: '𝕏' },
  'linkedin':   { label: 'LinkedIn',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',    emoji: 'in' },
  'tiktok':     { label: 'TikTok',     color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', emoji: '♪' },
  'pinterest':  { label: 'Pinterest',  color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20',    emoji: '📌' },
  'snapchat':   { label: 'Snapchat',   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', emoji: '👻' },
};

export const STATUS_FILTERS: { value: FilterState['status']; label: string }[] = [
  { value: 'all',              label: 'All' },
  { value: 'active',           label: 'Active' },
  { value: 'draft',            label: 'Draft' },
  { value: 'content_received', label: 'In Review' },
  { value: 'needs_revision',   label: 'Needs Revision' },
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
    badgeClass: 'bg-white/[0.04] text-slate-400 border-white/[0.08]',
    icon: Clock,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-slate-500 font-mono text-xs">—</span>;
  const normalized = platform.toLowerCase().trim();
  const cfg = PLATFORM_CONFIG[normalized];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${cfg ? cfg.bg : 'bg-white/[0.03] border-white/[0.08] text-slate-300'} ${cfg ? cfg.color : 'text-slate-300'}`}>
      {cfg
        ? <span className="text-[10px] leading-none">{cfg.emoji}</span>
        : <Globe className="w-3 h-3 opacity-60" />}
      <span>{cfg ? cfg.label : platform}</span>
    </span>
  );
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.06] animate-pulse">
      <td className="px-4 py-4 w-10"><div className="w-4 h-4 rounded bg-white/[0.06]" /></td>
      {[75, 55, 65, 50, 55, 40, 45, 30].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 rounded bg-white/[0.06]" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function EmptyState({ onCreateNew, onLoadSampleData, hasFilters, onClearFilters }: { onCreateNew: () => void; onLoadSampleData?: () => void; hasFilters: boolean; onClearFilters?: () => void; }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl mb-3 text-slate-400">
          <Search className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">No campaigns match your filter</h3>
        <p className="text-slate-400 text-xs mb-4">Try adjusting your search query or reset status filters.</p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-medium rounded-lg px-3 py-1.5 text-xs transition-colors border border-white/[0.08]"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="p-4 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl mb-4 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
        <MessageCircle className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1.5 tracking-tight">Zero campaigns tracked yet</h3>
      <p className="text-slate-400 text-xs max-w-sm mb-6 leading-relaxed">
        Connect WhatsApp to automatically extract campaigns from creator voice notes and DMs, or launch your first one manually.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] font-semibold rounded-xl px-4 py-2 text-xs transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          Create First Campaign
        </button>
        {onLoadSampleData && (
          <button
            id="load-sample-data-btn"
            onClick={onLoadSampleData}
            className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-medium rounded-xl px-4 py-2 text-xs transition-colors border border-white/[0.08]"
          >
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Load Sample Data
          </button>
        )}
      </div>
    </div>
  );
}
