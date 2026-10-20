'use client';

import React from 'react';
import type { InfluencerProfile } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import { PlatformIcon } from '@/components/PlatformIcon';
import { formatDisplayDate } from '@/lib/dates';
import { formatDisplayHandle, parsePlatformBadges } from './InfluencerCard';
import { X, Lock, Save, Calendar, Star } from 'lucide-react';

interface InfluencerDrawerProps {
  influencer: InfluencerProfile | null;
  campaigns: Campaign[];
  notes: string;
  isSaving: boolean;
  onNotesChange: (notes: string) => void;
  onSaveNotes: () => void;
  onClose: () => void;
}

export default function InfluencerDrawer({
  influencer,
  campaigns,
  notes,
  isSaving,
  onNotesChange,
  onSaveNotes,
  onClose,
}: InfluencerDrawerProps) {
  if (!influencer) return null;

  const initials = (influencer.name || influencer.handle)
    .replace(/^[^a-zA-Z0-9]+/, '')
    .slice(0, 2)
    .toUpperCase() || 'CR';

  const platformsList = parsePlatformBadges(influencer.platform);
  const displayHandle = formatDisplayHandle(influencer.handle, influencer.name);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-xl bg-white dark:bg-[#0A0E17] border-l border-slate-200 dark:border-white/[0.08] shadow-2xl flex flex-col justify-between overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Drawer Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/[0.07] pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#101624] border border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 font-mono text-base font-bold flex items-center justify-center shadow-inner">
                  {initials}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                    {influencer.name || 'Unknown'}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {displayHandle}
                    </span>
                    {platformsList.map(p => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]"
                      >
                        <PlatformIcon platform={p} className="w-2.5 h-2.5 opacity-80" fallbackToImage={false} />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                aria-label="Close dossier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3-Column Mini Stat Bar */}
            <div className="bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.07] rounded-xl p-3 grid grid-cols-3 divide-x divide-slate-200 dark:divide-white/[0.06] text-center">
              <div className="px-2">
                <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Campaigns</p>
                <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                  {influencer.total_campaigns}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Total Spend</p>
                <p className="font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {(influencer.total_spend || 0) > 0
                    ? `₹${influencer.total_spend.toLocaleString('en-IN')}`
                    : 'Gifted'}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Reliability</p>
                <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                  {influencer.success_rate < 0 ? 'In Progress' : `${influencer.success_rate}%`}
                </p>
              </div>
            </div>

            {/* Encrypted Brand Notes Terminal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white tracking-wide uppercase font-mono">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Private Creator Dossier & Rates
                </label>
                <span className="text-[10px] font-mono text-slate-500">Internal only</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Enter creator rate cards, manager contact, shipping address, or collaboration nuances..."
                className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-xs font-sans text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none transition-all leading-relaxed"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Auto-syncs across team workspace
                </span>
                <button
                  onClick={onSaveNotes}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>

            {/* Collaboration History Timeline */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white tracking-wide uppercase font-mono flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Collaboration History
                </h3>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {campaigns.length} {campaigns.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {campaigns.map(camp => (
                  <div
                    key={camp.id}
                    className="bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                        {camp.deliverables || 'Deliverables Package'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {formatDisplayDate(camp.created_at)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600 text-[10px]">•</span>
                        <span
                          className={`text-[9px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            camp.status === 'paid'
                              ? 'bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                              : camp.status === 'approved'
                              ? 'bg-blue-500/[0.08] text-blue-600 dark:text-blue-300 border-blue-500/20'
                              : camp.status === 'active'
                              ? 'bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                              : camp.status === 'content_received'
                              ? 'bg-amber-500/[0.08] text-amber-600 dark:text-amber-300 border-amber-500/20'
                              : 'bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]'
                          }`}
                        >
                          {camp.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {(camp.payment_amount || 0) > 0
                          ? `₹${camp.payment_amount?.toLocaleString('en-IN')}`
                          : 'Gifted'}
                      </span>
                    </div>
                  </div>
                ))}

                {campaigns.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-[#05070B] rounded-xl border border-slate-200 dark:border-white/[0.06] border-dashed">
                    <Star className="w-5 h-5 text-slate-400 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs text-slate-500 font-mono">No active campaign records found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#070A10] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] rounded-lg transition"
            >
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
