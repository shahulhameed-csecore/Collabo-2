'use client';

import React from 'react';
import type { Campaign } from '@/lib/types';
import { updateCampaignStatus, getApiErrorMessage } from '@/lib/api';
import { X, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export type FeedbackStep = 'input' | 'share';

export interface FeedbackModalState {
  id: string;
  step: FeedbackStep;
  feedback: string;
}

interface FeedbackModalProps {
  data: FeedbackModalState | null;
  campaigns: Campaign[];
  onClose: () => void;
  onRefresh: () => void;
  onChangeData: (updated: FeedbackModalState | null) => void;
}

export default function FeedbackModal({
  data,
  campaigns,
  onClose,
  onRefresh,
  onChangeData,
}: FeedbackModalProps) {
  if (!data) return null;

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
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            {data.step === 'input' ? 'Request Deliverable Revision' : 'Notify Influencer'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-5">
          {data.step === 'input' ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Specify required edits. This will mark the campaign as "Needs Revision" and generate a WhatsApp template.
              </p>
              <textarea
                autoFocus
                value={data.feedback}
                onChange={e => onChangeData({ ...data, feedback: e.target.value })}
                placeholder="E.g., The product packaging is partially obscured during seconds 0:04–0:08..."
                className="w-full h-28 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] rounded-lg p-3 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-lg transition-colors border border-slate-200 dark:border-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateCampaignStatus(data.id, { status: 'needs_revision', feedback: data.feedback });
                      toast.success('Status updated to Needs Revision');
                      onRefresh();
                      onChangeData({ ...data, step: 'share' });
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, 'Failed to update status'));
                    }
                  }}
                  disabled={!data.feedback.trim()}
                  className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] disabled:opacity-50"
                >
                  Save & Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Copy or dispatch this revision notice directly via WhatsApp.
              </p>
              {(() => {
                const campaign = campaigns.find(c => c.id === data.id);
                const link = campaign?.magic_link_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/submit-proof/${campaign.magic_link_token}` : '';
                const message = `Hi ${campaign?.influencer_name || 'there'},\n\nYour recent Collabo proof needs a quick revision.\n\nFeedback: ${data.feedback}\n\nPlease upload the updated version here:\n${link}`;
                
                return (
                  <>
                    <textarea
                      readOnly
                      value={message}
                      className="w-full h-40 bg-slate-50 dark:bg-[#05070B] border border-slate-200 dark:border-white/[0.08] rounded-lg p-3 text-slate-800 dark:text-slate-200 text-xs font-mono focus:outline-none resize-none"
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(message);
                          toast.success('Notice copied to clipboard!');
                        }}
                        className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-200 dark:border-white/[0.06]"
                      >
                        Copy Message
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#05070B] text-xs font-semibold rounded-lg transition-all shadow-[0_1px_8px_rgba(16,185,129,0.25)] text-center flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Send WhatsApp
                      </a>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
