'use client';

import { useState, useEffect } from 'react';
import { updateCampaign, getApiErrorMessage } from '@/lib/api';
import type { Campaign, CampaignFormState } from '@/lib/types';
import { PLATFORMS } from '@/lib/types';
import {
  X, CheckCircle2, DollarSign, AtSign, User, Tag, FileText, Info, Calendar, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface EditCampaignModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Form Field ────────────────────────────────────────────────────────────────
function Field({
  label, icon: Icon, required, children,
}: {
  label: string;
  icon: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold mb-2 tracking-wide text-slate-400">
        <Icon className="w-3.5 h-3.5" />
        {label}
        {required && <span className="text-rose-400 font-bold">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = () =>
  `w-full bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm
   focus:outline-none focus:ring-1 focus:border-emerald-500/50 focus:ring-emerald-500/15 transition-all resize-none`;

export default function EditCampaignModal({ campaign, isOpen, onClose, onSuccess }: EditCampaignModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CampaignFormState>({
    influencer_name: '',
    influencer_handle: '',
    platform: '',
    deliverables: '',
    deadline: '',
    payment_amount: '0',
    special_notes: '',
    status: 'draft',
  });

  // Initialize form when campaign changes
  useEffect(() => {
    if (campaign && isOpen) {
      setForm({
        influencer_name: campaign.influencer_name || '',
        influencer_handle: campaign.influencer_handle || '',
        platform: campaign.platform || '',
        deliverables: campaign.deliverables || '',
        deadline: campaign.deadline || '',
        payment_amount: String(campaign.payment_amount || 0),
        special_notes: campaign.special_notes || '',
        status: campaign.status,
      });
    }
  }, [campaign, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    
    if (!form.influencer_handle.trim()) {
      toast.error('Influencer handle (@username) is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCampaign(campaign.id, {
        influencer_name: form.influencer_name || null,
        influencer_handle: form.influencer_handle.trim(),
        platform: form.platform || null,
        deliverables: form.deliverables || null,
        deadline: form.deadline || null,
        payment_amount: parseFloat(form.payment_amount) || 0,
        special_notes: form.special_notes || null,
        status: form.status,
      });
      toast.success('Campaign updated successfully!');
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update campaign.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldChange = (field: keyof CampaignFormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={isSubmitting ? undefined : onClose} />

      <div className="relative w-full sm:max-w-2xl bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[95vh] animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/15 to-indigo-500/10 rounded-xl border border-blue-500/20">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">Edit Campaign</h2>
              <p className="text-xs text-slate-500 mt-0.5">Update details for {campaign.influencer_name || campaign.influencer_handle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute right-4 top-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form id="edit-campaign-form" onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Influencer Name" icon={User}>
                <input
                  type="text"
                  value={form.influencer_name}
                  onChange={e => fieldChange('influencer_name', e.target.value)}
                  placeholder="Riya Sharma"
                  className={inputCls()}
                />
              </Field>

              <Field label="Handle" icon={AtSign} required>
                <input
                  type="text"
                  required
                  value={form.influencer_handle}
                  onChange={e => fieldChange('influencer_handle', e.target.value)}
                  placeholder="@riya_creates"
                  className={inputCls()}
                />
              </Field>

              <Field label="Platform" icon={Tag}>
                <select
                  value={form.platform}
                  onChange={e => fieldChange('platform', e.target.value)}
                  className={inputCls()}
                >
                  <option value="">Select platform</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="Deadline" icon={Calendar}>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => fieldChange('deadline', e.target.value)}
                  className={inputCls()}
                />
              </Field>

              <Field label="Payment (₹ INR)" icon={DollarSign}>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.payment_amount}
                    onChange={e => fieldChange('payment_amount', e.target.value)}
                    placeholder="0 for gifted deal"
                    className={`${inputCls()} pl-8`}
                  />
                </div>
                {form.payment_amount === '0' && (
                  <p className="text-xs text-emerald-400/70 mt-1 ml-1">₹0 = Gifted Deal 🎁</p>
                )}
              </Field>

              <Field label="Status" icon={Info}>
                <select
                  value={form.status}
                  onChange={e => fieldChange('status', e.target.value as CampaignFormState['status'])}
                  className={inputCls()}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>

            <Field label="Deliverables" icon={FileText}>
              <textarea
                rows={2}
                value={form.deliverables}
                onChange={e => fieldChange('deliverables', e.target.value)}
                placeholder="1 Reel (30s) + 2 Story frames with swipe-up link"
                className={inputCls()}
              />
            </Field>

            <Field label="Special Notes / Instructions" icon={FileText}>
              <textarea
                rows={2}
                value={form.special_notes}
                onChange={e => fieldChange('special_notes', e.target.value)}
                placeholder="Moodboard link, brand colours, dos & don'ts..."
                className={inputCls()}
              />
            </Field>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 bg-slate-900/95 px-5 py-4 flex-shrink-0 flex items-center justify-end">
          <button
            type="submit"
            form="edit-campaign-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-all shadow-lg shadow-blue-500/25"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
