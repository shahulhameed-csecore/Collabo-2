'use client';

import React from 'react';
import type { Campaign } from '@/lib/types';
import { Clock, X, ExternalLink } from 'lucide-react';

interface ProofHistoryModalProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export default function ProofHistoryModal({ campaign, onClose }: ProofHistoryModalProps) {
  if (!campaign) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md h-full bg-white dark:bg-[#0A0E17] border-l border-slate-200 dark:border-white/[0.08] p-6 flex flex-col justify-between shadow-2xl animate-slide-in-right overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.06] mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Proof Revision History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {campaign.influencer_name} ({campaign.influencer_handle})
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Latest Active Proof */}
          {campaign.proof_url && (
            <div className="mb-5 p-3.5 bg-emerald-500/10 dark:bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                  Latest Submission
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              </div>
              <a
                href={campaign.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-emerald-600 dark:text-emerald-300 hover:underline flex items-center gap-1.5 break-all"
              >
                <span>{campaign.proof_url}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}

          {/* Previous Iterations */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
              Iteration Log ({campaign.proof_history?.length || 0})
            </p>
            {campaign.proof_history && campaign.proof_history.length > 0 ? (
              campaign.proof_history.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl hover:border-slate-300 dark:hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200">
                      Version {idx + 1}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {new Date(item.uploaded_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1.5 break-all mt-1.5"
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 font-mono py-4 text-center">
                No prior revisions recorded for this campaign.
              </p>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-white/[0.06] mt-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold transition-colors border border-slate-200 dark:border-white/[0.06]"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
