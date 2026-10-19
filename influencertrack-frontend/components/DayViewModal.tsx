'use client';

import { Campaign } from '@/lib/types';
import { X, Calendar as CalendarIcon, CheckCircle2, ArrowRight } from 'lucide-react';
import { PlatformBadge, StatusBadge } from '@/components/CampaignTableUtils';

interface DayViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
}

export default function DayViewModal({ isOpen, onClose, dateStr, campaigns, onSelectCampaign }: DayViewModalProps) {
  if (!isOpen) return null;

  // Parse YYYY-MM-DD string to local midnight to avoid timezone shifts
  const parseLocalDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  };

  const localDate = parseLocalDate(dateStr);
  const formattedDate = localDate.toLocaleDateString('en-IN', { 
    weekday: 'long', 
    day: 'numeric',
    month: 'long', 
    year: 'numeric'
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Daily Deliverables</h2>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] px-2 py-0.5 rounded-md">
                  {campaigns.length} {campaigns.length === 1 ? 'Deliverable' : 'Deliverables'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Campaign List */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          {campaigns.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No campaigns due on this date</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">All influencer commitments on schedule.</p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => {
                  onClose();
                  onSelectCampaign(campaign);
                }}
                className="group p-4 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#05070B] hover:bg-slate-100/80 dark:hover:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.12] transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {campaign.influencer_name || campaign.influencer_handle || 'Unknown Influencer'}
                    </h3>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                      {campaign.influencer_handle?.startsWith('@') ? campaign.influencer_handle : `@${campaign.influencer_handle || 'creator'}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <PlatformBadge platform={campaign.platform} />
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                      {campaign.deliverables || 'Brief in progress'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {campaign.payment_amount != null && campaign.payment_amount > 0 ? (
                      <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{campaign.payment_amount.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <p className="font-mono text-xs text-slate-400 dark:text-slate-500">—</p>
                    )}
                    <div className="mt-1">
                      <StatusBadge status={campaign.status} />
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-white/[0.06]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
