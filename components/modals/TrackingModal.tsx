'use client';

import React from 'react';
import type { Campaign } from '@/lib/types';
import { TrendingUp, X } from 'lucide-react';

interface TrackingModalProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export default function TrackingModal({ campaign, onClose }: TrackingModalProps) {
  if (!campaign) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#0A0E17] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Link Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{campaign.influencer_name}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
            aria-label="Close analytics modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-emerald-500/20 rounded-xl p-5 text-center mb-4">
            <p className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Total Verified Clicks</p>
            <p className="font-mono text-5xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {campaign.clicks}
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-200 dark:border-white/[0.06]">
              <span className="text-xs text-slate-500 dark:text-slate-400">Cost Per Click (CPC)</span>
              <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                {campaign.clicks > 0 
                  ? `₹${((campaign.payment_amount || 0) / campaign.clicks).toFixed(2)}` 
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-200 dark:border-white/[0.06]">
              <span className="text-xs text-slate-500 dark:text-slate-400">Destination</span>
              <a 
                href={campaign.destination_url || '#'} 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline max-w-[200px] truncate"
              >
                {campaign.destination_url || 'None'}
              </a>
            </div>
          </div>
        </div>
        
        <div className="p-5 pt-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold rounded-lg px-4 py-2.5 transition-colors border border-slate-200 dark:border-white/[0.06]"
          >
            Close Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
