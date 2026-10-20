'use client';

import React from 'react';
import type { InfluencerProfile } from '@/lib/api';
import { PlatformIcon } from '@/components/PlatformIcon';
import { formatDisplayDate } from '@/lib/dates';
import { Clock, FileText, ChevronRight } from 'lucide-react';

interface InfluencerCardProps {
  influencer: InfluencerProfile;
  onClick: () => void;
}

export const normalizeHandle = (handle?: string | null, name?: string | null): string => {
  let h = (handle || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1).trim();
  if (!h || ['n/a', 'none', 'unknown', 'null', 'undefined'].includes(h)) {
    const n = (name || '').trim().toLowerCase();
    if (n && !['unknown', 'n/a', 'none'].includes(n)) {
      return n.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'creator';
    }
    return 'creator';
  }
  return h.replace(/^[^\w]+/, '') || h;
};

export const formatDisplayHandle = (handle: string, name?: string | null): string => {
  const norm = normalizeHandle(handle, name);
  return `@${norm}`;
};

export const parsePlatformBadges = (platformStr?: string | null): string[] => {
  if (!platformStr) return [];
  return platformStr
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
};

export default function InfluencerCard({ influencer, onClick }: InfluencerCardProps) {
  const initials = (influencer.name || influencer.handle)
    .replace(/^[^a-zA-Z0-9]+/, '')
    .slice(0, 2)
    .toUpperCase() || 'CR';

  const platformsList = parsePlatformBadges(influencer.platform);
  const displayHandle = formatDisplayHandle(influencer.handle, influencer.name);

  return (
    <tr
      onClick={onClick}
      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
    >
      {/* 1. CREATOR */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#101624] border border-slate-200 dark:border-white/[0.10] text-slate-700 dark:text-slate-200 font-mono text-xs font-semibold flex items-center justify-center shadow-inner relative flex-shrink-0">
            {initials}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#0A0E17] ${
                influencer.success_rate >= 70
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : influencer.success_rate < 0
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-rose-500 dark:bg-rose-400'
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="font-sans text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
              {influencer.name || 'Unknown'}
            </p>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
              {displayHandle}
            </p>
          </div>
        </div>
      </td>

      {/* 2. PLATFORMS */}
      <td className="px-5 py-3.5">
        {platformsList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {platformsList.map(p => {
              const pLower = p.toLowerCase();
              const isYoutube = pLower.includes('youtube') || pLower.includes('yt');
              const isInstagram = pLower.includes('instagram') || pLower.includes('ig');
              const isTiktok = pLower.includes('tiktok');
              const isTwitter = pLower.includes('twitter') || pLower.includes('x');
              const isLinkedin = pLower.includes('linkedin');

              const badgeStyle = isYoutube
                ? 'bg-rose-500/[0.08] text-rose-600 dark:text-rose-300 border-rose-500/20'
                : isInstagram
                ? 'bg-pink-500/[0.08] text-pink-600 dark:text-pink-300 border-pink-500/20'
                : isTiktok
                ? 'bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300 border-cyan-500/20'
                : isTwitter
                ? 'bg-sky-500/[0.08] text-sky-600 dark:text-sky-300 border-sky-500/20'
                : isLinkedin
                ? 'bg-blue-500/[0.08] text-blue-600 dark:text-blue-300 border-blue-500/20'
                : 'bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]';

              return (
                <span
                  key={p}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${badgeStyle}`}
                >
                  <PlatformIcon platform={p} className="w-3 h-3 flex-shrink-0 opacity-80" fallbackToImage={false} />
                  <span>{p}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
        )}
      </td>

      {/* 3. CAMPAIGNS */}
      <td className="px-5 py-3.5">
        <span className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] px-2 py-0.5 rounded">
          {influencer.total_campaigns} {influencer.total_campaigns === 1 ? 'collab' : 'collabs'}
        </span>
      </td>

      {/* 4. TOTAL SPEND */}
      <td className="px-5 py-3.5">
        <span className="font-mono tabular-nums text-sm font-medium text-slate-900 dark:text-slate-200">
          {(influencer.total_spend || 0) > 0 ? (
            `₹${influencer.total_spend.toLocaleString('en-IN')}`
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">Gifted / Barter</span>
          )}
        </span>
      </td>

      {/* 5. RELIABILITY / SUCCESS RATE */}
      <td className="px-5 py-3.5">
        {influencer.success_rate < 0 ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/[0.08] border border-amber-500/20 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  influencer.success_rate >= 70
                    ? 'bg-emerald-500 dark:bg-emerald-400'
                    : influencer.success_rate >= 40
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-rose-500 dark:bg-rose-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, influencer.success_rate))}%` }}
              />
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {influencer.success_rate}%
            </span>
          </div>
        )}
      </td>

      {/* 6. LAST COLLAB */}
      <td className="px-5 py-3.5 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
        {influencer.last_collaboration ? formatDisplayDate(influencer.last_collaboration) : '—'}
      </td>

      {/* 7. DOSSIER ACTION */}
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {influencer.notes && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-1.5 py-0.5 rounded truncate max-w-[90px]">
              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
              Notes
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            <span>Dossier</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </td>
    </tr>
  );
}
