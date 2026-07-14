'use client';

import { Campaign } from '@/lib/types';
import { X, Calendar as CalendarIcon, Clock, CheckCircle2, Play, Image as ImageIcon, Video, User } from 'lucide-react';

interface DayViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  content_received: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  approved: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  paid: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
};

const getPlatformIcon = (platform: string | null | undefined) => {
  const p = platform?.toLowerCase() || '';
  if (p.includes('instagram') || p.includes('reel') || p.includes('story')) return <Play className="w-4 h-4" />;
  if (p.includes('youtube') || p.includes('shorts')) return <Video className="w-4 h-4" />;
  return <ImageIcon className="w-4 h-4" />;
};

export default function DayViewModal({ isOpen, onClose, dateStr, campaigns, onSelectCampaign }: DayViewModalProps) {
  if (!isOpen) return null;

  // Parse YYYY-MM-DD string to local midnight to avoid timezone shifts
  const parseLocalDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };

  // Format date like "October 24, 2024"
  const formattedDate = parseLocalDate(dateStr).toLocaleDateString('default', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-500" />
              Daily Agenda
            </h2>
            <p className="text-sm text-slate-500 mt-1">{formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">No campaigns due on this date.</p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => {
                  onClose();
                  onSelectCampaign(campaign);
                }}
                className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 hover:border-emerald-500/50 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500 group-hover:text-emerald-500 transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                        {campaign.influencer_name || campaign.influencer_handle || 'Unknown Influencer'}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          {getPlatformIcon(campaign.platform)}
                          {campaign.deliverables || 'TBD deliverables'}
                        </p>
                        {campaign.payment_amount != null && campaign.payment_amount > 0 && (
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            ₹{campaign.payment_amount.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${STATUS_COLORS[campaign.status] || STATUS_COLORS.draft}`}>
                    {campaign.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
